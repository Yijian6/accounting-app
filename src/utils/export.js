import { formatFullDate } from './format';
import { buildBackupPayload, filterBackupDataByMonth } from './backup';
import { saveFile } from './saveFile';

export function exportCSV(records) {
  const header = '金额,类型,分类,标签,备注,时间';
  const rows = records.map((record) => {
    const tags = Array.isArray(record.tags) ? record.tags.join(';') : '';
    const note = (record.note || '').replace(/,/g, '，');
    const type = record.type === 'expense' ? '支出' : '收入';
    return `${record.amount},${type},${record.category},${tags},${note},${formatFullDate(record.datetime)}`;
  });

  const csv = '\uFEFF' + header + '\n' + rows.join('\n');
  return downloadFile(csv, '记账数据.csv', 'text/csv;charset=utf-8');
}

export function exportJSON(records) {
  const data = records.map((record) => ({
    amount: record.amount,
    type: record.type === 'expense' ? '支出' : '收入',
    category: record.category,
    tags: record.tags,
    note: record.note || '',
    datetime: formatFullDate(record.datetime),
  }));

  const json = JSON.stringify(data, null, 2);
  return downloadFile(json, '记账数据.json', 'application/json;charset=utf-8');
}

/** monthKey 为 '2026-11' 时只导出该月记录；不传则导出全部 */
export function exportBackupJSON(data, { monthKey } = {}) {
  const scoped = monthKey ? filterBackupDataByMonth(data, monthKey) : data;
  const backup = buildBackupPayload(scoped);
  const json = JSON.stringify(backup, null, 2);
  const suffix = monthKey ? `${monthKey}-` : '';
  return downloadFile(json, `accounting-backup-${suffix}${Date.now()}.json`, 'application/json;charset=utf-8');
}

function downloadFile(content, filename, mimeType) {
  return saveFile(new Blob([content], { type: mimeType }), filename);
}
