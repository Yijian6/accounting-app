import { formatAmount } from './format';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function money(amount) {
  return `¥${formatAmount(amount || 0)}`;
}

export function percent(value) {
  return `${Math.round((value || 0) * 100)}%`;
}

function formatSignedMoney(amount) {
  if (Math.abs(amount || 0) < 0.01) return '持平';
  return `${amount > 0 ? '+' : '-'}${money(Math.abs(amount))}`;
}

export function getChangeLabel(item) {
  if (!item) return '';
  if (item.changeState === 'new') return '本期新增';
  if (item.changeState === 'none' || item.changeState === 'flat') return '基本持平';
  return formatSignedMoney(item.changeAmount);
}

function toDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatShortDate(value) {
  const date = toDate(value);
  if (!date) return '';
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

export function getDayKey(value) {
  const date = toDate(value);
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDayHeading(value) {
  const date = toDate(value);
  if (!date) return '';
  return `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`;
}

export function getRecordDisplayAmount(record) {
  return Number.isFinite(record.attributedAmount) ? record.attributedAmount : record.amount;
}

export function getRecordTitle(record) {
  if (Array.isArray(record.tags) && record.tags.length > 0) return record.tags.join(' / ');
  if (record.note) return record.note;
  return '未标记';
}

export function getRecordSubtitle(record, { withDate = true } = {}) {
  const parts = [];
  const hasTags = Array.isArray(record.tags) && record.tags.length > 0;
  const note = typeof record.note === 'string' ? record.note.trim() : '';
  if (hasTags && note) parts.push(note);
  if (withDate) parts.push(formatShortDate(record.datetime));
  if (record.isAttributedAmount) parts.push('本期归属');
  return parts.filter(Boolean).join(' · ');
}

/** 搜索：标签、备注、金额、日期（03/16、3月16日、2026-03-16）都能命中 */
export function recordMatches(record, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const date = toDate(record.datetime);
  const amount = getRecordDisplayAmount(record);
  const haystack = [
    ...(Array.isArray(record.tags) ? record.tags : []),
    record.note || '',
    String(amount),
    formatAmount(amount),
    String(record.amount),
    formatShortDate(record.datetime),
    getDayKey(record.datetime),
    date ? `${date.getMonth() + 1}月${date.getDate()}日` : '',
    date ? `${date.getMonth() + 1}/${date.getDate()}` : '',
  ].join(' ').toLowerCase();
  return haystack.includes(needle);
}
