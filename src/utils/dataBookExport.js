import { getRecordAmountInRange } from './statistics';
import { formatAmount } from './format';

const DAY_MS = 24 * 60 * 60 * 1000;
const APP_NAME = '拾序记账';
const SCHEMA_VERSION = '1.0';

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  return new Date(startOfDay(date).getTime() + amount * DAY_MS);
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function addMonthsClamped(date, amount) {
  const start = startOfDay(date);
  const targetMonth = start.getMonth() + amount;
  const targetDay = Math.min(
    start.getDate(),
    getDaysInMonth(start.getFullYear(), targetMonth)
  );

  return new Date(start.getFullYear(), targetMonth, targetDay);
}

function addYearsClamped(date, amount) {
  const start = startOfDay(date);
  const targetYear = start.getFullYear() + amount;
  const targetDay = Math.min(
    start.getDate(),
    getDaysInMonth(targetYear, start.getMonth())
  );

  return new Date(targetYear, start.getMonth(), targetDay);
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
      start,
      endExclusive: addMonthsClamped(start, 1),
    };
  }

  if (record.recurrence.type === 'yearly') {
    return {
      start,
      endExclusive: addYearsClamped(start, 1),
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

function stylesXml(colors) {
  const accentArgb = hexToArgb(colors.accent);
  const accentPaleArgb = hexToArgb(colors.accentPale);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="¥#,##0.00"/></numFmts>
  <fonts count="4">
    <font><sz val="11"/><color rgb="FF292524"/><name val="Microsoft YaHei"/></font>
    <font><b/><sz val="18"/><color rgb="${accentArgb}"/><name val="Microsoft YaHei"/></font>
    <font><sz val="10"/><color rgb="FF8B817B"/><name val="Microsoft YaHei"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Microsoft YaHei"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${accentArgb}"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${accentPaleArgb}"/><bgColor indexed="64"/></patternFill></fill>
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

function buildXlsx(book, colors) {
  const sheets = buildSheets(book);
  const files = [
    { name: '[Content_Types].xml', content: contentTypesXml(sheets.length) },
    { name: '_rels/.rels', content: rootRelsXml() },
    { name: 'xl/workbook.xml', content: workbookXml(sheets) },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml(sheets.length) },
    { name: 'xl/styles.xml', content: stylesXml(colors) },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      content: sheetXml(sheet.rows, sheet.widths),
    })),
  ];
  return createZip(files);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoneyText(value) {
  return `¥${formatAmount(money(value))}`;
}

function formatPercentText(value) {
  const percent = Number(value || 0) * 100;
  return `${percent.toFixed(percent >= 10 ? 0 : 1)}%`;
}

function buildHtmlMetric(label, value, tone = '') {
  return `
    <div class="metric ${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>`;
}

function buildHtmlRows(rows, emptyText) {
  if (!rows.length) {
    return `<tr class="empty-row"><td colspan="9">${escapeHtml(emptyText)}</td></tr>`;
  }
  return rows.join('');
}

function buildHtmlDocument(book, colors) {
  const c = colors;
  const isDark = isDarkTheme(c.bg);
  const meta = book.metadata;
  const overview = book.overview;
  const maxCategoryAmount = Math.max(...book.categorySummary.map((item) => item.expenseAmount), 1);
  const maxTimeAmount = Math.max(...book.timeSummary.map((item) => item.expenseAmount), 1);

  const categoryRows = buildHtmlRows(book.categorySummary.map((item) => {
    const width = Math.max(4, Math.round((Number(item.expenseAmount || 0) / maxCategoryAmount) * 100));
    return `
      <tr>
        <td><strong>${escapeHtml(item.category)}</strong></td>
        <td class="num expense">${formatMoneyText(item.expenseAmount)}</td>
        <td class="num income">${formatMoneyText(item.incomeAmount)}</td>
        <td class="num">${escapeHtml(item.recordCount)}</td>
        <td>
          <div class="share-cell">
            <span class="share-track"><i style="width:${width}%"></i></span>
            <b>${escapeHtml(formatPercentText(item.expenseShare))}</b>
          </div>
        </td>
      </tr>`;
  }), '这个范围内还没有分类数据。');

  const timeRows = buildHtmlRows(book.timeSummary.map((item) => {
    const width = Math.max(4, Math.round((Number(item.expenseAmount || 0) / maxTimeAmount) * 100));
    return `
      <tr>
        <td><strong>${escapeHtml(item.periodLabel)}</strong><small>${escapeHtml(item.periodKey)}</small></td>
        <td class="num expense">${formatMoneyText(item.expenseAmount)}</td>
        <td class="num income">${formatMoneyText(item.incomeAmount)}</td>
        <td class="num">${escapeHtml(item.recordCount)}</td>
        <td><span class="line-bar"><i style="width:${width}%"></i></span></td>
      </tr>`;
  }), '这个范围内还没有时间汇总。');

  const recordRows = buildHtmlRows(book.records.map((record) => {
    const searchText = [
      record.date,
      record.time,
      record.type,
      record.category,
      record.tags,
      record.note,
      record.amount,
    ].join(' ');
    return `
      <tr data-search="${escapeHtml(searchText.toLowerCase())}">
        <td>${escapeHtml(record.date)}<small>${escapeHtml(record.time)}</small></td>
        <td><span class="pill">${escapeHtml(record.type)}</span></td>
        <td><strong>${escapeHtml(record.category)}</strong></td>
        <td>${escapeHtml(record.tags || '-')}</td>
        <td>${escapeHtml(record.note || '-')}</td>
        <td class="num ${record.type === '收入' ? 'income' : 'expense'}">${formatMoneyText(record.amount)}</td>
        <td>${escapeHtml(record.isPeriodic)}</td>
      </tr>`;
  }), '这个范围内还没有记录明细。');

  const periodicRows = buildHtmlRows(book.periodicAttribution.map((item) => `
      <tr>
        <td>${escapeHtml(item.originalPaymentDate)}</td>
        <td><strong>${escapeHtml(item.category)}</strong></td>
        <td class="num">${formatMoneyText(item.originalAmount)}</td>
        <td>${escapeHtml(item.periodicType)}</td>
        <td>${escapeHtml(item.serviceStart)}<small>${escapeHtml(item.serviceEnd)}</small></td>
        <td class="num">${escapeHtml(item.rangeOverlapDays)}</td>
        <td class="num expense">${formatMoneyText(item.attributedAmount)}</td>
        <td class="num">${formatMoneyText(item.dailyAttributedAmount)}</td>
      </tr>`), '这个范围内没有需要呈现的周期归属。');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(meta.appName)} · ${escapeHtml(meta.rangeLabel)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700;900&display=swap" rel="stylesheet" />
  <style>
    :root {
      color-scheme: ${isDark ? 'dark' : 'light'};
      --ink: ${c.text};
      --soft: ${c.textSoft};
      --muted: ${c.textMuted};
      --ghost: ${c.textGhost};
      --line: ${c.textGhost};
      --paper: ${c.bg};
      --card: ${c.bgCard};
      --up: ${c.bgUp};
      --accent: ${c.accent};
      --accent-deep: ${c.accentDeep};
      --accent-pale: ${c.accentPale};
      --accent-wash: ${c.accentWash};
      --gold: ${c.accentDeep};
      --green: ${c.green};
      --green-soft: ${c.greenSoft};
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      background: var(--paper);
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
    }
    .page {
      width: min(880px, calc(100% - 32px));
      margin: 0 auto;
      padding: 48px 0 64px;
    }
    /* ── Hero ── */
    .hero {
      position: relative;
      padding-bottom: 28px;
      border-bottom: 1px solid var(--line);
    }
    .hero::before {
      content: "";
      position: absolute;
      top: -40px;
      right: -60px;
      width: 220px;
      height: 220px;
      background: radial-gradient(circle, var(--accent-wash), transparent 70%);
      pointer-events: none;
    }
    .hero > * { position: relative; }
    .kicker {
      display: inline-block;
      padding: 4px 14px;
      border: 1px solid var(--ghost);
      border-radius: 999px;
      color: var(--accent);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
    }
    h1 {
      margin: 16px 0 8px;
      font-family: "Noto Serif SC", serif;
      font-size: clamp(30px, 5vw, 44px);
      font-weight: 900;
      letter-spacing: -0.02em;
      line-height: 1.12;
    }
    .range-line {
      display: block;
      margin-bottom: 10px;
      color: var(--ink);
      font-size: 14px;
      font-weight: 700;
    }
    .hero p,
    .section-head p,
    .footer-note {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.6;
    }
    .hero-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-top: 20px;
      color: var(--muted);
      font-size: 12px;
    }
    .hero-meta strong {
      color: var(--soft);
      font-weight: 600;
    }
    /* ── Metrics ── */
    .metrics {
      display: flex;
      border-bottom: 1px solid var(--line);
    }
    .metric {
      flex: 1;
      min-width: 0;
      padding: 20px 20px 20px 0;
      border-right: 1px solid var(--line);
    }
    .metric:first-child { padding-left: 0; }
    .metric:last-child { border-right: none; }
    .metric span {
      display: block;
      color: var(--muted);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .metric strong {
      display: block;
      margin-top: 6px;
      font-family: "Noto Serif SC", serif;
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }
    .metric.expense strong { color: var(--ink); }
    .metric.income strong { color: var(--green); }
    /* ── TOC ── */
    .toc {
      display: flex;
      gap: 0;
      padding: 12px 0;
      border-bottom: 1px solid var(--line);
    }
    .toc a {
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
      padding: 6px 16px;
      border-right: 1px solid var(--line);
      transition: color 0.16s;
    }
    .toc a:first-child { padding-left: 0; }
    .toc a:last-child { border-right: none; }
    .toc a:hover { color: var(--accent); }
    /* ── Sections ── */
    .section { margin-top: 40px; }
    .section-head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--line);
    }
    .section-title {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .section-index {
      color: var(--accent);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.14em;
      font-variant-numeric: tabular-nums;
    }
    h2 {
      margin: 0 0 4px;
      font-family: "Noto Serif SC", serif;
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0;
    }
    /* ── Tables ── */
    .table-wrap { width: 100%; overflow-x: auto; }
    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 680px;
    }
    th, td {
      padding: 11px 14px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: middle;
      font-size: 13px;
    }
    th {
      position: sticky;
      top: 0;
      z-index: 1;
      color: var(--muted);
      background: var(--paper);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    td { color: var(--soft); }
    td strong { color: var(--ink); font-weight: 600; }
    td small {
      display: block;
      margin-top: 2px;
      color: var(--muted);
      font-size: 11px;
    }
    tbody tr { transition: background 0.15s; }
    tbody tr:hover { background: var(--accent-wash); }
    .num {
      text-align: right;
      font-family: "Noto Serif SC", serif;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .expense { color: var(--ink); }
    .income { color: var(--green); }
    /* ── Share bars ── */
    .share-cell {
      display: grid;
      grid-template-columns: minmax(80px, 1fr) 40px;
      gap: 8px;
      align-items: center;
    }
    .share-track, .line-bar {
      display: block;
      height: 4px;
      overflow: hidden;
      border-radius: 2px;
      background: var(--up);
    }
    .share-track i, .line-bar i {
      display: block;
      height: 100%;
      border-radius: 2px;
      background: linear-gradient(90deg, var(--accent), var(--gold));
    }
    .share-cell b {
      color: var(--muted);
      font-size: 11px;
      font-variant-numeric: tabular-nums;
      text-align: right;
    }
    /* ── Misc ── */
    .pill {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid var(--ghost);
      color: var(--soft);
      font-size: 11px;
      font-weight: 700;
    }
    .record-tools {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .record-tools input {
      width: 200px;
      max-width: 40vw;
      min-height: 32px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--ink);
      background: var(--up);
      font-size: 12px;
      outline: none;
    }
    .record-tools input::placeholder { color: var(--muted); }
    .record-tools button {
      min-height: 32px;
      padding: 0 14px;
      border: 0;
      border-radius: 999px;
      color: var(--paper);
      background: var(--accent);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .empty-row td {
      color: var(--muted);
      text-align: center;
      padding: 28px 16px;
    }
    .footer-note {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid var(--line);
      text-align: center;
    }
    @media (max-width: 680px) {
      .page { width: calc(100% - 24px); padding: 24px 0 40px; }
      h1 { font-size: 28px; }
      .metrics { flex-wrap: wrap; }
      .metric { flex: 0 0 50%; border-bottom: 1px solid var(--line); }
      .metric:nth-child(2) { border-right: none; }
      .toc { flex-wrap: wrap; }
      .toc a { padding: 6px 12px; }
      .section-head { flex-direction: column; align-items: flex-start; }
      .record-tools { width: 100%; }
      .record-tools input { flex: 1; max-width: none; }
    }
    @media print {
      body { background: #fff; color: #222; }
      .hero::before { display: none; }
      .toc, .record-tools { display: none; }
      th { position: static; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <span class="kicker">拾序 · 数据册</span>
      <h1>${escapeHtml(meta.rangeLabel)}</h1>
      <p>一份结构化的消费去向记录。只呈现数据，不评价消费行为。</p>
      <div class="hero-meta">
        <span>导出 <strong>${escapeHtml(meta.exportedAt)}</strong></span>
        <span>范围 <strong>${escapeHtml(meta.rangeStart)} — ${escapeHtml(meta.rangeEnd)}</strong></span>
      </div>
    </section>

    <section class="metrics">
      ${buildHtmlMetric('支出总额', formatMoneyText(overview.expenseTotal), 'expense')}
      ${buildHtmlMetric('收入总额', formatMoneyText(overview.incomeTotal), 'income')}
      ${buildHtmlMetric('记录数量', `${overview.recordCount} 笔`)}
      ${buildHtmlMetric('周期归属', formatMoneyText(overview.periodicAttributedTotal))}
    </section>

    <nav class="toc" aria-label="数据册目录">
      <a href="#category">01 分类去向</a>
      <a href="#time">02 时间轨迹</a>
      <a href="#records">03 记录明细</a>
      <a href="#periodic">04 周期归属</a>
    </nav>

    <section class="section" id="category">
      <div class="section-head">
        <div>
          <div class="section-title"><span class="section-index">01</span><h2>分类去向</h2></div>
          <p>按分类呈现支出、收入与记录数量。</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>分类</th><th class="num">支出</th><th class="num">收入</th><th class="num">记录</th><th>支出占比</th></tr></thead>
          <tbody>${categoryRows}</tbody>
        </table>
      </div>
    </section>

    <section class="section" id="time">
      <div class="section-head">
        <div>
          <div class="section-title"><span class="section-index">02</span><h2>时间轨迹</h2></div>
          <p>按时间呈现记录的自然分布。</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>周期</th><th class="num">支出</th><th class="num">收入</th><th class="num">记录</th><th>支出条</th></tr></thead>
          <tbody>${timeRows}</tbody>
        </table>
      </div>
    </section>

    <section class="section" id="records">
      <div class="section-head">
        <div>
          <div class="section-title"><span class="section-index">03</span><h2>记录明细</h2></div>
          <p>保留每一笔记录的付款真实。</p>
        </div>
        <div class="record-tools">
          <input id="recordSearch" type="search" placeholder="搜索明细" />
          <button type="button" onclick="window.print()">打印</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>日期</th><th>类型</th><th>分类</th><th>标签</th><th>备注</th><th class="num">金额</th><th>周期</th></tr></thead>
          <tbody id="recordRows">${recordRows}</tbody>
        </table>
      </div>
    </section>

    <section class="section" id="periodic">
      <div class="section-head">
        <div>
          <div class="section-title"><span class="section-index">04</span><h2>周期归属</h2></div>
          <p>周期支出按所选范围呈现归属金额。</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>原付款日</th><th>分类</th><th class="num">原金额</th><th>周期</th><th>归属范围</th><th class="num">重合天数</th><th class="num">归属金额</th><th class="num">日均归属</th></tr></thead>
          <tbody>${periodicRows}</tbody>
        </table>
      </div>
    </section>

    <p class="footer-note">这份数据册只帮助你看见钱去了哪里。它不提供评价、建议或压力。</p>
  </main>
  <script>
    const searchInput = document.getElementById('recordSearch');
    const recordRows = Array.from(document.querySelectorAll('#recordRows tr[data-search]'));
    searchInput?.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      recordRows.forEach((row) => {
        row.hidden = query && !row.dataset.search.includes(query);
      });
    });
  </script>
</body>
</html>`;
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

function getThemeColors() {
  const style = getComputedStyle(document.documentElement);
  const get = (name) => style.getPropertyValue(name).trim();
  return {
    bg: get('--bg'), bgUp: get('--bg-up'), bgCard: get('--bg-card'),
    bgLine: get('--bg-line'),
    accent: get('--accent'), accentDeep: get('--accent-deep'),
    accentPale: get('--accent-pale'), accentWash: get('--accent-wash'),
    text: get('--text'), textSoft: get('--text-soft'),
    textMuted: get('--text-muted'), textGhost: get('--text-ghost'),
    green: get('--green'), greenSoft: get('--green-soft'),
    warn: get('--warn'), danger: get('--danger'),
  };
}

function isDarkTheme(bgColor) {
  const hex = (bgColor || '').replace('#', '');
  if (hex.length < 6) return false;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
}

function hexToArgb(hex) {
  const clean = (hex || '').replace('#', '');
  if (clean.length >= 6) return 'FF' + clean.substring(0, 6).toUpperCase();
  return 'FF292524';
}

export function exportDataBook(records, { rangeType = 'month', format = 'xlsx' } = {}) {
  const safeRecords = Array.isArray(records) ? records : [];
  const book = buildDataBook(safeRecords, rangeType);
  const colors = getThemeColors();
  const fileDate = formatDate(new Date()).replaceAll('-', '');
  const filenameBase = `shiyu-data-book-${book.metadata.rangeType}-${fileDate}`;

  if (format === 'json') {
    const blob = new Blob([JSON.stringify(book, null, 2)], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, `${filenameBase}.json`);
    return;
  }

  if (format === 'html') {
    const html = buildHtmlDocument(book, colors);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, `${filenameBase}.html`);
    return;
  }

  const xlsxBytes = buildXlsx(book, colors);
  const blob = new Blob([xlsxBytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `${filenameBase}.xlsx`);
}
