import { getRecordAmountInRange } from './statistics';

const DAY_MS = 24 * 60 * 60 * 1000;
const APP_NAME = '生活记账';
const SCHEMA_VERSION = '1.0';

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  return new Date(startOfDay(date).getTime() + amount * DAY_MS);
}

function startOfWeek(date) {
  const day = date.getDay() || 7;
  const start = startOfDay(date);
  start.setDate(start.getDate() - day + 1);
  return start;
}

function formatDate(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

function formatDateTime(date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getRecordDate(record) {
  return parseDate(record.datetime);
}

function getExportRange(records, rangeType) {
  const now = new Date();

  if (rangeType === 'week') {
    const start = startOfWeek(now);
    return {
      rangeType,
      start,
      endExclusive: addDays(start, 7),
      label: `${formatDate(start)} 至 ${formatDate(addDays(start, 6))}`,
    };
  }

  if (rangeType === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const endExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
      rangeType,
      start,
      endExclusive,
      label: `${now.getFullYear()}年${now.getMonth() + 1}月`,
    };
  }

  if (rangeType === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    const endExclusive = new Date(now.getFullYear() + 1, 0, 1);
    return {
      rangeType,
      start,
      endExclusive,
      label: `${now.getFullYear()}年`,
    };
  }

  const dates = records.map(getRecordDate).filter(Boolean).sort((a, b) => a - b);
  const start = dates[0] ? startOfDay(dates[0]) : startOfDay(now);
  const endExclusive = addDays(startOfDay(now), 1);
  return {
    rangeType: 'all',
    start,
    endExclusive,
    label: '全部数据',
  };
}

function isRecordInRange(record, range) {
  const date = getRecordDate(record);
  if (!date) return false;
  return date >= range.start && date < range.endExclusive;
}

function money(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function getServiceRange(record) {
  const date = getRecordDate(record);
  if (!date || !record?.recurrence?.type) return null;
  const start = startOfDay(date);

  if (record.recurrence.type === 'monthly') {
    return {
      start: new Date(start.getFullYear(), start.getMonth(), 1),
      endExclusive: new Date(start.getFullYear(), start.getMonth() + 1, 1),
    };
  }

  if (record.recurrence.type === 'yearly') {
    return {
      start,
      endExclusive: addDays(start, 365),
    };
  }

  return null;
}

function getOverlapDays(left, right) {
  const start = left.start > right.start ? left.start : right.start;
  const endExclusive = left.endExclusive < right.endExclusive ? left.endExclusive : right.endExclusive;
  return Math.max(0, Math.round((startOfDay(endExclusive) - startOfDay(start)) / DAY_MS));
}

function getPeriodKey(date, rangeType) {
  if (rangeType === 'year' || rangeType === 'all') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  return formatDate(date);
}

function getPeriodLabel(key, rangeType) {
  if (rangeType === 'year' || rangeType === 'all') {
    const [year, month] = key.split('-');
    return `${year}年${Number(month)}月`;
  }

  return key;
}

function groupByCategory(records) {
  const map = new Map();
  records.forEach((record) => {
    const category = record.category || '未分类';
    if (!map.has(category)) {
      map.set(category, {
        category,
        expenseAmount: 0,
        incomeAmount: 0,
        recordCount: 0,
      });
    }

    const item = map.get(category);
    const amount = money(record.amount);
    item.recordCount += 1;
    if (record.type === 'income') {
      item.incomeAmount += amount;
    } else {
      item.expenseAmount += amount;
    }
  });

  const expenseTotal = [...map.values()].reduce((sum, item) => sum + item.expenseAmount, 0);
  return [...map.values()]
    .map((item) => ({
      ...item,
      expenseShare: expenseTotal > 0 ? item.expenseAmount / expenseTotal : 0,
    }))
    .sort((left, right) => right.expenseAmount - left.expenseAmount);
}

function groupByTime(records, rangeType) {
  const map = new Map();
  records.forEach((record) => {
    const date = getRecordDate(record);
    if (!date) return;
    const key = getPeriodKey(date, rangeType);
    if (!map.has(key)) {
      map.set(key, {
        periodKey: key,
        periodLabel: getPeriodLabel(key, rangeType),
        expenseAmount: 0,
        incomeAmount: 0,
        recordCount: 0,
      });
    }

    const item = map.get(key);
    const amount = money(record.amount);
    item.recordCount += 1;
    if (record.type === 'income') {
      item.incomeAmount += amount;
    } else {
      item.expenseAmount += amount;
    }
  });

  return [...map.values()].sort((left, right) => left.periodKey.localeCompare(right.periodKey));
}

function buildPeriodicAttribution(records, range) {
  return records
    .filter((record) => record?.recurrence?.type)
    .map((record) => {
      const serviceRange = getServiceRange(record);
      if (!serviceRange) return null;
      const attributedAmount = money(getRecordAmountInRange(record, range));
      if (attributedAmount <= 0) return null;
      const serviceDays = Math.max(1, Math.round((serviceRange.endExclusive - serviceRange.start) / DAY_MS));
      const overlapDays = getOverlapDays(serviceRange, range);
      return {
        recordId: record.id,
        originalPaymentDate: formatDate(getRecordDate(record)),
        category: record.category || '未分类',
        originalAmount: money(record.amount),
        periodicType: record.recurrence.type === 'yearly' ? '年' : '月',
        serviceStart: formatDate(serviceRange.start),
        serviceEnd: formatDate(addDays(serviceRange.endExclusive, -1)),
        rangeOverlapDays: overlapDays,
        attributedAmount,
        dailyAttributedAmount: money(Number(record.amount || 0) / serviceDays),
      };
    })
    .filter(Boolean);
}

function buildDataBook(records, rangeType) {
  const range = getExportRange(records, rangeType);
  const scopedRecords = records
    .filter((record) => isRecordInRange(record, range))
    .sort((left, right) => new Date(left.datetime) - new Date(right.datetime));
  const categorySummary = groupByCategory(scopedRecords);
  const timeSummary = groupByTime(scopedRecords, range.rangeType);
  const periodicAttribution = buildPeriodicAttribution(records, range);
  const expenseTotal = scopedRecords
    .filter((record) => record.type !== 'income')
    .reduce((sum, record) => sum + money(record.amount), 0);
  const incomeTotal = scopedRecords
    .filter((record) => record.type === 'income')
    .reduce((sum, record) => sum + money(record.amount), 0);

  return {
    metadata: {
      appName: APP_NAME,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: formatDateTime(new Date()),
      rangeType: range.rangeType,
      rangeLabel: range.label,
      rangeStart: formatDate(range.start),
      rangeEnd: formatDate(addDays(range.endExclusive, -1)),
    },
    overview: {
      expenseTotal: money(expenseTotal),
      incomeTotal: money(incomeTotal),
      netTotal: money(incomeTotal - expenseTotal),
      recordCount: scopedRecords.length,
      categoryCount: categorySummary.length,
      periodicAttributedTotal: money(periodicAttribution.reduce((sum, item) => sum + item.attributedAmount, 0)),
    },
    categorySummary,
    timeSummary,
    records: scopedRecords.map((record) => {
      const date = getRecordDate(record);
      return {
        recordId: record.id,
        date: formatDate(date),
        time: formatTime(date),
        type: record.type === 'income' ? '收入' : '支出',
        amount: money(record.amount),
        category: record.category || '未分类',
        tags: Array.isArray(record.tags) ? record.tags.join(' / ') : '',
        note: record.note || '',
        isPeriodic: record.recurrence ? '是' : '否',
        periodicType: record.recurrence?.type === 'yearly' ? '年' : (record.recurrence?.type === 'monthly' ? '月' : ''),
      };
    }),
    periodicAttribution,
  };
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function columnName(index) {
  let name = '';
  let value = index + 1;
  while (value > 0) {
    const mod = (value - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    value = Math.floor((value - mod) / 26);
  }
  return name;
}

function cellXml(cell, rowIndex, columnIndex) {
  const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
  const style = cell.style ? ` s="${cell.style}"` : '';
  if (cell.type === 'n' && Number.isFinite(Number(cell.value))) {
    return `<c r="${ref}"${style}><v>${Number(cell.value)}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"${style}><is><t>${escapeXml(cell.value)}</t></is></c>`;
}

function rowXml(row, rowIndex) {
  return `<row r="${rowIndex + 1}">${row.map((cell, columnIndex) => cellXml(cell, rowIndex, columnIndex)).join('')}</row>`;
}

function text(value, style = 0) {
  return { value, style, type: 's' };
}

function num(value, style = 0) {
  return { value, style, type: 'n' };
}

function sheetXml(rows, widths = []) {
  const cols = widths.length
    ? `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  ${cols}
  <sheetData>${rows.map(rowXml).join('')}</sheetData>
</worksheet>`;
}

function buildWorksheet(title, subtitle, headers, dataRows) {
  return [
    [text(title, 1)],
    [text(subtitle, 2)],
    [],
    headers.map((header) => text(header, 3)),
    ...dataRows,
  ].map((row) => row.length ? row : [text('')]);
}

function buildSheets(book) {
  const meta = book.metadata;
  const overviewRows = [
    [text('应用'), text(meta.appName)],
    [text('导出时间'), text(meta.exportedAt)],
    [text('范围'), text(meta.rangeLabel)],
    [text('开始日期'), text(meta.rangeStart)],
    [text('结束日期'), text(meta.rangeEnd)],
    [text('记录数'), num(book.overview.recordCount, 6)],
    [text('分类数'), num(book.overview.categoryCount, 6)],
    [text('支出总额'), num(book.overview.expenseTotal, 4)],
    [text('收入总额'), num(book.overview.incomeTotal, 4)],
    [text('净额'), num(book.overview.netTotal, 4)],
    [text('周期归属金额'), num(book.overview.periodicAttributedTotal, 4)],
  ];

  return [
    {
      name: '总览',
      widths: [18, 24, 18, 18],
      rows: buildWorksheet('记账数据册', '一份结构化的数据副本，不包含消费评价。', ['项目', '内容'], overviewRows, []),
    },
    {
      name: '分类汇总',
      widths: [20, 16, 16, 14, 14],
      rows: buildWorksheet(
        '分类汇总',
        '按分类呈现支出、收入与记录数量。',
        ['分类', '支出金额', '收入金额', '记录数', '支出占比'],
        book.categorySummary.map((item) => [
          text(item.category),
          num(money(item.expenseAmount), 4),
          num(money(item.incomeAmount), 4),
          num(item.recordCount, 6),
          num(item.expenseShare, 5),
        ]),
      ),
    },
    {
      name: '时间汇总',
      widths: [18, 18, 16, 16, 14],
      rows: buildWorksheet(
        '时间汇总',
        '按时间呈现记录的自然分布。',
        ['周期', '标签', '支出金额', '收入金额', '记录数'],
        book.timeSummary.map((item) => [
          text(item.periodKey),
          text(item.periodLabel),
          num(money(item.expenseAmount), 4),
          num(money(item.incomeAmount), 4),
          num(item.recordCount, 6),
        ]),
      ),
    },
    {
      name: '记录明细',
      widths: [18, 12, 12, 14, 18, 24, 28, 12, 12],
      rows: buildWorksheet(
        '记录明细',
        '保留每一笔记录的付款真实。',
        ['日期', '时间', '类型', '金额', '分类', '标签', '备注', '周期', '周期类型'],
        book.records.map((record) => [
          text(record.date),
          text(record.time),
          text(record.type),
          num(record.amount, 4),
          text(record.category),
          text(record.tags),
          text(record.note),
          text(record.isPeriodic),
          text(record.periodicType),
        ]),
      ),
    },
    {
      name: '周期归属',
      widths: [18, 18, 14, 12, 16, 16, 14, 16, 16],
      rows: buildWorksheet(
        '周期归属',
        '周期支出按所选导出范围呈现归属金额。',
        ['原始付款日', '分类', '原金额', '周期', '归属开始', '归属结束', '重叠天数', '归属金额', '日均归属'],
        book.periodicAttribution.map((item) => [
          text(item.originalPaymentDate),
          text(item.category),
          num(item.originalAmount, 4),
          text(item.periodicType),
          text(item.serviceStart),
          text(item.serviceEnd),
          num(item.rangeOverlapDays, 6),
          num(item.attributedAmount, 4),
          num(item.dailyAttributedAmount, 4),
        ]),
      ),
    },
  ];
}

function contentTypesXml(sheetCount) {
  const sheets = Array.from({ length: sheetCount }, (_, index) => (
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  )).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheets}
</Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function workbookXml(sheets) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets>
</workbook>`;
}

function workbookRelsXml(sheetCount) {
  const sheetRels = Array.from({ length: sheetCount }, (_, index) => (
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  )).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRels}
  <Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="¥#,##0.00"/></numFmts>
  <fonts count="4">
    <font><sz val="11"/><color rgb="FF292524"/><name val="Microsoft YaHei"/></font>
    <font><b/><sz val="18"/><color rgb="FF211D1F"/><name val="Microsoft YaHei"/></font>
    <font><sz val="10"/><color rgb="FF8B817B"/><name val="Microsoft YaHei"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Microsoft YaHei"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF211D1F"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF7EFF3"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFE7E2E5"/></left><right style="thin"><color rgb="FFE7E2E5"/></right><top style="thin"><color rgb="FFE7E2E5"/></top><bottom style="thin"><color rgb="FFE7E2E5"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="10" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
  </cellXfs>
</styleSheet>`;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
  }
  return value >>> 0;
});

function crc32(bytes) {
  let crc = 0 ^ -1;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[index]) & 0xFF];
  }
  return (crc ^ -1) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

function uint16(value) {
  return [value & 0xFF, (value >>> 8) & 0xFF];
}

function uint32(value) {
  return [value & 0xFF, (value >>> 8) & 0xFF, (value >>> 16) & 0xFF, (value >>> 24) & 0xFF];
}

function concatBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const bytes = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => {
    bytes.set(part, offset);
    offset += part.length;
  });
  return bytes;
}

function createZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const stamp = dosDateTime();

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
    const crc = crc32(dataBytes);
    const localHeader = new Uint8Array([
      ...uint32(0x04034b50), ...uint16(20), ...uint16(0), ...uint16(0),
      ...uint16(stamp.time), ...uint16(stamp.date), ...uint32(crc),
      ...uint32(dataBytes.length), ...uint32(dataBytes.length),
      ...uint16(nameBytes.length), ...uint16(0),
    ]);
    const localEntry = concatBytes([localHeader, nameBytes, dataBytes]);
    localParts.push(localEntry);

    const centralHeader = new Uint8Array([
      ...uint32(0x02014b50), ...uint16(20), ...uint16(20), ...uint16(0), ...uint16(0),
      ...uint16(stamp.time), ...uint16(stamp.date), ...uint32(crc),
      ...uint32(dataBytes.length), ...uint32(dataBytes.length),
      ...uint16(nameBytes.length), ...uint16(0), ...uint16(0),
      ...uint16(0), ...uint16(0), ...uint32(0), ...uint32(offset),
    ]);
    centralParts.push(concatBytes([centralHeader, nameBytes]));
    offset += localEntry.length;
  });

  const centralDirectory = concatBytes(centralParts);
  const endRecord = new Uint8Array([
    ...uint32(0x06054b50), ...uint16(0), ...uint16(0),
    ...uint16(files.length), ...uint16(files.length),
    ...uint32(centralDirectory.length), ...uint32(offset),
    ...uint16(0),
  ]);

  return concatBytes([...localParts, centralDirectory, endRecord]);
}

function buildXlsx(book) {
  const sheets = buildSheets(book);
  const files = [
    { name: '[Content_Types].xml', content: contentTypesXml(sheets.length) },
    { name: '_rels/.rels', content: rootRelsXml() },
    { name: 'xl/workbook.xml', content: workbookXml(sheets) },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml(sheets.length) },
    { name: 'xl/styles.xml', content: stylesXml() },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      content: sheetXml(sheet.rows, sheet.widths),
    })),
  ];
  return createZip(files);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function exportDataBook(records, { rangeType = 'month', format = 'xlsx' } = {}) {
  const safeRecords = Array.isArray(records) ? records : [];
  const book = buildDataBook(safeRecords, rangeType);
  const fileDate = formatDate(new Date()).replaceAll('-', '');
  const filenameBase = `accounting-data-book-${book.metadata.rangeType}-${fileDate}`;

  if (format === 'json') {
    const blob = new Blob([JSON.stringify(book, null, 2)], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, `${filenameBase}.json`);
    return;
  }

  const xlsxBytes = buildXlsx(book);
  const blob = new Blob([xlsxBytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `${filenameBase}.xlsx`);
}
