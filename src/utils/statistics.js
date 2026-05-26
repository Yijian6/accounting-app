const DAY_MS = 24 * 60 * 60 * 1000;
const CHANGE_FLAT_THRESHOLD = 0.01;

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date, amount) {
  return new Date(startOfDay(date).getTime() + amount * DAY_MS);
}

function isValidDate(date) {
  return Number.isFinite(date.getTime());
}

function parseRecordDate(record) {
  const date = new Date(record.datetime);
  return isValidDate(date) ? date : null;
}

function formatDayLabel(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}

function getDateKey(date) {
  return startOfDay(date).toISOString();
}

function formatMoney(amount) {
  return `¥${Number(amount || 0).toFixed(2)}`;
}

function getPeriodLabel(days) {
  return days === 7 ? '近7天' : '近30天';
}

function getPreviousPeriodLabel(days) {
  return days === 7 ? '前7天' : '前30天';
}

function getPeriodRange(days, now = new Date()) {
  const end = startOfDay(now);
  const start = addDays(end, -(days - 1));

  return {
    start,
    end,
    endExclusive: addDays(end, 1),
  };
}

function isDateInRange(date, range) {
  return date >= range.start && date < range.endExclusive;
}

function maxDate(left, right) {
  return left > right ? left : right;
}

function minDate(left, right) {
  return left < right ? left : right;
}

function getDaysBetween(start, endExclusive) {
  return Math.max(0, Math.round((startOfDay(endExclusive) - startOfDay(start)) / DAY_MS));
}

function isRecurringRecord(record) {
  return record?.recurrence?.type === 'monthly' || record?.recurrence?.type === 'yearly';
}

function getServiceRange(record) {
  const paymentDate = parseRecordDate(record);
  if (!paymentDate || !isRecurringRecord(record)) {
    return null;
  }

  const start = startOfDay(paymentDate);

  if (record.recurrence.type === 'monthly') {
    return {
      start: new Date(start.getFullYear(), start.getMonth(), 1),
      endExclusive: new Date(start.getFullYear(), start.getMonth() + 1, 1),
    };
  }

  return {
    start,
    endExclusive: addDays(start, 365),
  };
}

function getOverlapDays(leftRange, rightRange) {
  const start = maxDate(leftRange.start, rightRange.start);
  const endExclusive = minDate(leftRange.endExclusive, rightRange.endExclusive);
  return getDaysBetween(start, endExclusive);
}

function isFlowRecord(record, type) {
  if (record?.type !== type || !record?.datetime || !record?.category) {
    return false;
  }

  const amount = Number(record.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return false;
  }

  return !!parseRecordDate(record);
}

export function getRecordAmountInRange(record, range) {
  if (!record || !range) return 0;

  const date = parseRecordDate(record);
  if (!date) return 0;

  const amount = Number(record.amount);
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  const serviceRange = getServiceRange(record);
  if (serviceRange) {
    const serviceDays = getDaysBetween(serviceRange.start, serviceRange.endExclusive);
    const overlapDays = getOverlapDays(serviceRange, range);
    if (serviceDays <= 0 || overlapDays <= 0) return 0;
    return (amount / serviceDays) * overlapDays;
  }

  return isDateInRange(date, range) ? amount : 0;
}

function getChangeState(currentAmount, previousAmount) {
  if (currentAmount === 0 && previousAmount === 0) return 'none';
  if (previousAmount === 0 && currentAmount > 0) return 'new';

  const changeAmount = currentAmount - previousAmount;
  if (Math.abs(changeAmount) < CHANGE_FLAT_THRESHOLD) return 'flat';
  return changeAmount > 0 ? 'up' : 'down';
}

function getChangePercent(currentAmount, previousAmount) {
  if (previousAmount === 0) {
    return currentAmount > 0 ? null : 0;
  }

  return ((currentAmount - previousAmount) / previousAmount) * 100;
}

function buildEmptySeries(range, periodDays) {
  return Array.from({ length: periodDays }, (_, index) => {
    const date = addDays(range.start, index);
    return {
      key: getDateKey(date),
      label: formatDayLabel(date),
      amount: 0,
    };
  });
}

function buildPeriodSnapshot(records, range, periodDays) {
  const series = buildEmptySeries(range, periodDays);
  const seriesByKey = new Map(series.map((item) => [item.key, item]));
  const categories = new Map();
  const periodRecords = [];
  const periodRecordIds = new Set();
  const fixedRecordIds = new Set();
  let fixedTotal = 0;

  records.forEach((record) => {
    const date = parseRecordDate(record);
    if (!date) return;

    const categoryName = record.category;
    const serviceRange = getServiceRange(record);
    const contributions = [];

    if (serviceRange) {
      const serviceDays = getDaysBetween(serviceRange.start, serviceRange.endExclusive);
      const overlapDays = getOverlapDays(serviceRange, range);
      if (serviceDays <= 0 || overlapDays <= 0) return;

      const dailyAmount = Number(record.amount) / serviceDays;
      fixedRecordIds.add(record.id);
      fixedTotal += dailyAmount * overlapDays;

      series.forEach((item) => {
        const day = new Date(item.key);
        if (day >= serviceRange.start && day < serviceRange.endExclusive) {
          contributions.push({ key: item.key, amount: dailyAmount });
        }
      });
    } else {
      if (!isDateInRange(date, range)) return;
      contributions.push({ key: getDateKey(date), amount: Number(record.amount) });
    }

    if (!contributions.length) return;

    if (!periodRecordIds.has(record.id)) {
      periodRecordIds.add(record.id);
      periodRecords.push(record);
    }

    if (!categories.has(categoryName)) {
      categories.set(categoryName, {
        name: categoryName,
        amount: 0,
        series: buildEmptySeries(range, periodDays),
        recentRecords: [],
      });
    }

    const category = categories.get(categoryName);
    contributions.forEach((contribution) => {
      const bucket = seriesByKey.get(contribution.key);
      if (bucket) {
        bucket.amount += contribution.amount;
      }

      category.amount += contribution.amount;
      const categoryDay = category.series.find((item) => item.key === contribution.key);
      if (categoryDay) {
        categoryDay.amount += contribution.amount;
      }
    });

    category.recentRecords.push(record);
  });

  const sortedRecords = periodRecords.sort((left, right) => (
    new Date(right.datetime) - new Date(left.datetime)
  ));

  categories.forEach((category) => {
    category.recentRecords = category.recentRecords
      .sort((left, right) => new Date(right.datetime) - new Date(left.datetime))
      .slice(0, 6);
  });

  return {
    total: series.reduce((sum, item) => sum + item.amount, 0),
    series,
    categories,
    records: sortedRecords,
    fixedExpenseSummary: {
      total: fixedTotal,
      dailyAverage: periodDays > 0 ? fixedTotal / periodDays : 0,
      count: fixedRecordIds.size,
    },
  };
}

function describeChange(currentAmount, previousAmount, previousLabel) {
  const state = getChangeState(currentAmount, previousAmount);
  const changeAmount = currentAmount - previousAmount;

  if (state === 'none') return '和上一周期一样平静。';
  if (state === 'new') return `${previousLabel}没有支出记录，本期是新的支出。`;
  if (state === 'flat') return `和${previousLabel}基本持平。`;
  if (state === 'up') return `比${previousLabel}多 ${formatMoney(changeAmount)}。`;
  return `比${previousLabel}少 ${formatMoney(Math.abs(changeAmount))}。`;
}

function buildCategoryItems(currentSnapshot, previousSnapshot, totalAmount) {
  const names = new Set([
    ...currentSnapshot.categories.keys(),
    ...previousSnapshot.categories.keys(),
  ]);

  return Array.from(names).map((name) => {
    const current = currentSnapshot.categories.get(name);
    const previous = previousSnapshot.categories.get(name);
    const currentAmount = current?.amount || 0;
    const previousAmount = previous?.amount || 0;
    const changeAmount = currentAmount - previousAmount;

    return {
      name,
      currentAmount,
      previousAmount,
      share: totalAmount > 0 ? currentAmount / totalAmount : 0,
      changeAmount,
      changePercent: getChangePercent(currentAmount, previousAmount),
      changeState: getChangeState(currentAmount, previousAmount),
      series: current?.series || currentSnapshot.series.map((item) => ({ ...item, amount: 0 })),
      recentRecords: current?.recentRecords || [],
    };
  }).sort((left, right) => {
    if (right.currentAmount !== left.currentAmount) {
      return right.currentAmount - left.currentAmount;
    }
    return right.previousAmount - left.previousAmount;
  });
}

function buildCompositionSegments(categoryItems, totalAmount) {
  if (totalAmount <= 0) return [];

  const visible = categoryItems.filter((item) => item.currentAmount > 0).slice(0, 5);
  const visibleAmount = visible.reduce((sum, item) => sum + item.currentAmount, 0);
  const restAmount = Math.max(totalAmount - visibleAmount, 0);

  const segments = visible.map((item) => ({
    name: item.name,
    amount: item.currentAmount,
    share: item.currentAmount / totalAmount,
  }));

  if (restAmount > CHANGE_FLAT_THRESHOLD) {
    segments.push({
      name: '其他',
      amount: restAmount,
      share: restAmount / totalAmount,
    });
  }

  return segments;
}

function buildInsight(currentTotal, previousTotal, topCategory, periodLabel, previousLabel) {
  if (currentTotal <= 0) {
    return {
      insightTitle: '这段时间几乎没有支出',
      insightBody: `${periodLabel}没有记录到支出。你可以把它理解为一个很安静的周期。`,
    };
  }

  const shareText = topCategory ? `${Math.round(topCategory.share * 100)}%` : '0%';
  return {
    insightTitle: topCategory ? `钱主要花在${topCategory.name}` : '这段时间有一些支出',
    insightBody: topCategory
      ? `${topCategory.name}占${periodLabel}支出的${shareText}，${describeChange(currentTotal, previousTotal, previousLabel)}`
      : describeChange(currentTotal, previousTotal, previousLabel),
  };
}

function buildAttention(categoryItems, periodLabel, previousLabel) {
  const increased = categoryItems
    .filter((item) => item.currentAmount > 0 && item.changeAmount > CHANGE_FLAT_THRESHOLD)
    .sort((left, right) => right.changeAmount - left.changeAmount)[0];

  if (increased) {
    return {
      tone: 'warning',
      title: `${increased.name}是主要增量`,
      body: `${periodLabel}在${increased.name}上比${previousLabel}多花了 ${formatMoney(increased.changeAmount)}。`,
    };
  }

  const decreased = categoryItems
    .filter((item) => item.previousAmount > 0 && item.changeAmount < -CHANGE_FLAT_THRESHOLD)
    .sort((left, right) => left.changeAmount - right.changeAmount)[0];

  if (decreased) {
    return {
      tone: 'good',
      title: `${decreased.name}有所下降`,
      body: `${periodLabel}在${decreased.name}上比${previousLabel}少花了 ${formatMoney(Math.abs(decreased.changeAmount))}。`,
    };
  }

  return {
    tone: 'calm',
    title: '没有明显异常增量',
    body: `和${previousLabel}相比，主要分类没有出现值得紧张的上升。`,
  };
}

function buildSelectedCategoryDetail(categoryItems, selectedCategory) {
  const fallback = categoryItems.find((item) => item.currentAmount > 0) || categoryItems[0] || null;
  const selected = categoryItems.find((item) => item.name === selectedCategory) || fallback;

  if (!selected) {
    return null;
  }

  return {
    ...selected,
    dailyAverage: selected.series.length > 0
      ? selected.currentAmount / selected.series.length
      : 0,
  };
}

function buildFixedFlowSummary(snapshot, periodLabel, type) {
  const { total, dailyAverage, count } = snapshot.fixedExpenseSummary;
  const label = type === 'income' ? '周期收入' : '周期支出';

  if (!count) {
    return {
      total: 0,
      dailyAverage: 0,
      count: 0,
      description: `本期没有归属进来的${label}。`,
    };
  }

  return {
    total,
    dailyAverage,
    count,
    description: `${periodLabel}${label}归属 ${formatMoney(total)}，日均 ${formatMoney(dailyAverage)}，来自 ${count} 笔${label}。`,
  };
}

export function getStatisticsInsightViewModel(
  records,
  periodDays = 7,
  selectedCategory = '',
  now = new Date()
) {
  const safePeriodDays = periodDays === 30 ? 30 : 7;
  const periodLabel = getPeriodLabel(safePeriodDays);
  const previousPeriodLabel = getPreviousPeriodLabel(safePeriodDays);
  const currentRange = getPeriodRange(safePeriodDays, now);
  const previousRange = {
    start: addDays(currentRange.start, -safePeriodDays),
    end: addDays(currentRange.end, -safePeriodDays),
    endExclusive: currentRange.start,
  };
  const safeRecords = Array.isArray(records) ? records : [];
  const expenseRecords = safeRecords.filter((record) => isFlowRecord(record, 'expense'));
  const incomeRecords = safeRecords.filter((record) => isFlowRecord(record, 'income'));
  const currentSnapshot = buildPeriodSnapshot(expenseRecords, currentRange, safePeriodDays);
  const previousSnapshot = buildPeriodSnapshot(expenseRecords, previousRange, safePeriodDays);
  const currentIncomeSnapshot = buildPeriodSnapshot(incomeRecords, currentRange, safePeriodDays);
  const categoryItems = buildCategoryItems(currentSnapshot, previousSnapshot, currentSnapshot.total);
  const topCategories = categoryItems
    .filter((item) => item.currentAmount > 0)
    .slice(0, 5);
  const topCategory = topCategories[0] || null;
  const { insightTitle, insightBody } = buildInsight(
    currentSnapshot.total,
    previousSnapshot.total,
    topCategory,
    periodLabel,
    previousPeriodLabel
  );
  const selectedCategoryDetail = buildSelectedCategoryDetail(categoryItems, selectedCategory);
  const changeAmount = currentSnapshot.total - previousSnapshot.total;

  return {
    periodDays: safePeriodDays,
    periodLabel,
    previousPeriodLabel,
    currentTotal: currentSnapshot.total,
    currentIncomeTotal: currentIncomeSnapshot.total,
    previousTotal: previousSnapshot.total,
    changeAmount,
    changePercent: getChangePercent(currentSnapshot.total, previousSnapshot.total),
    changeState: getChangeState(currentSnapshot.total, previousSnapshot.total),
    insightTitle,
    insightBody,
    topCategories,
    compositionSegments: buildCompositionSegments(categoryItems, currentSnapshot.total),
    attention: buildAttention(categoryItems, periodLabel, previousPeriodLabel),
    selectedCategoryDetail,
    fixedExpenseSummary: buildFixedFlowSummary(currentSnapshot, periodLabel, 'expense'),
    fixedIncomeSummary: buildFixedFlowSummary(currentIncomeSnapshot, periodLabel, 'income'),
    series: currentSnapshot.series,
    recentRecords: currentSnapshot.records.slice(0, 8),
    hasRecords: currentSnapshot.records.length > 0,
  };
}

export function getStatisticsViewModel(
  records,
  periodDays,
  selectedCategory = 'all',
  selectedTag = 'all',
  now = new Date()
) {
  const category = selectedCategory === 'all' ? '' : selectedCategory;
  return {
    ...getStatisticsInsightViewModel(records, periodDays, category, now),
    selectedTag,
  };
}
