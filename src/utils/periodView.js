/**
 * 任意一段时间（某个月、某一年）里「钱去了哪里」：
 * 圆环分段、去向详情、细分构成。日历、圆环、详情都从这里取数，保证同一段时间数字一致。
 *
 * 口径：只算支出，按付款日期归入时间段（和日历每格的金额一致），不做周期分摊。
 */

const VISIBLE_SEGMENTS = 5;
const NO_TAG = '不分细分';

function inRange(record, start, endExclusive) {
  const date = new Date(record.datetime);
  if (Number.isNaN(date.getTime())) return false;
  return date >= start && date < endExclusive;
}

export function monthRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  return { start, endExclusive: new Date(date.getFullYear(), date.getMonth() + 1, 1) };
}

export function yearRange(date) {
  const start = new Date(date.getFullYear(), 0, 1);
  return { start, endExclusive: new Date(date.getFullYear() + 1, 0, 1) };
}

/** 前 5 个去向单列，其余合成一块（和统计页一致）；用户自己有「其他」时合并块叫「其余」 */
function buildSegments(groups, total) {
  if (total <= 0) return [];
  const sorted = [...groups.values()].sort((left, right) => right.amount - left.amount);
  const visible = sorted.slice(0, VISIBLE_SEGMENTS);
  const rest = sorted.slice(VISIBLE_SEGMENTS);
  const segments = visible.map((group, index) => ({
    name: group.name,
    amount: group.amount,
    share: group.amount / total,
    color: `var(--cat-${(index % 5) + 1})`,
  }));
  const restAmount = rest.reduce((sum, group) => sum + group.amount, 0);
  if (restAmount > 0) {
    segments.push({
      name: visible.some((group) => group.name === '其他') ? '其余' : '其他',
      amount: restAmount,
      share: restAmount / total,
      color: 'var(--text-muted)',
      isRest: true,
      categories: rest.map((group) => ({ name: group.name, amount: group.amount, share: group.amount / total })),
    });
  }
  return segments;
}

/**
 * @param noun 「本月」「本年」，用在「占本月 42%」里
 */
export function buildPeriodView(records, { start, endExclusive }, noun) {
  const groups = new Map();
  let total = 0;

  records.forEach((record) => {
    if (record.type !== 'expense' || !inRange(record, start, endExclusive)) return;
    const amount = Number(record.amount || 0);
    const name = record.category || '未分类';
    if (!groups.has(name)) groups.set(name, { name, amount: 0, records: [] });
    const group = groups.get(name);
    group.amount += amount;
    group.records.push(record);
    total += amount;
  });

  const segments = buildSegments(groups, total);

  const detailFor = (name) => {
    const group = groups.get(name);
    if (!group) return null;
    const share = total > 0 ? group.amount / total : 0;
    return {
      name,
      currentAmount: group.amount,
      share,
      records: [...group.records].sort((left, right) => new Date(right.datetime) - new Date(left.datetime)),
      // 不和上一期比：这一期可能还没过完，比较只会误导
      meta: `占${noun} ${Math.round(share * 100)}% · ${group.records.length} 笔`,
      note: group.records.some((record) => record.recurrence) ? '含周期支出，按付款日计' : '',
    };
  };

  return { total, segments, destinationCount: groups.size, detailFor };
}

/**
 * 一组记录按细分汇总：一笔记录只进一个桶（多细分的旧记录用「A / B」作为一个桶），
 * 所以各桶相加正好等于总额。没有任何细分时返回空数组。
 */
export function tagBreakdown(records, amountOf = (record) => Number(record.amount || 0)) {
  const buckets = new Map();
  let tagged = 0;
  records.forEach((record) => {
    const tags = Array.isArray(record.tags) ? record.tags.filter(Boolean) : [];
    if (tags.length > 0) tagged += 1;
    const key = tags.length > 0 ? tags.join(' / ') : NO_TAG;
    buckets.set(key, (buckets.get(key) || 0) + amountOf(record));
  });
  if (tagged === 0) return [];
  return [...buckets.entries()]
    .map(([name, amount]) => ({ name, amount, untagged: name === NO_TAG }))
    .sort((left, right) => (left.untagged - right.untagged) || (right.amount - left.amount));
}
