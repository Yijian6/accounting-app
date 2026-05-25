import { formatFullDate, generateId } from './format';

export const BACKUP_VERSION = 1;

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRecord(record) {
  if (!isObject(record)) return null;

  const amount = Number(record.amount);
  const datetime = new Date(record.datetime);
  const type = record.type;
  const category = typeof record.category === 'string' ? record.category.trim() : '';
  const tags = Array.isArray(record.tags)
    ? record.tags.filter((tag) => typeof tag === 'string' && tag.trim())
    : [];
  const note = typeof record.note === 'string' ? record.note : '';

  if (!Number.isFinite(amount) || !Number.isFinite(datetime.getTime())) return null;
  if (type !== 'expense' && type !== 'income') return null;
  if (!category) return null;

  return {
    id: typeof record.id === 'string' && record.id ? record.id : generateId(),
    amount,
    type,
    category,
    tags,
    note,
    datetime: datetime.toISOString(),
    recurrence: normalizeRecurrence(record.recurrence),
  };
}

function normalizeRecurrence(value) {
  if (!isObject(value)) return null;
  if (value.type !== 'monthly' && value.type !== 'yearly') return null;
  return { type: value.type };
}

function normalizeCategory(category) {
  if (!isObject(category)) return null;
  const name = typeof category.name === 'string' ? category.name.trim() : '';
  const type = category.type;
  if (!name || (type !== 'expense' && type !== 'income')) return null;

  return {
    id: typeof category.id === 'string' && category.id ? category.id : generateId(),
    name,
    type,
  };
}

function normalizeTag(tag) {
  if (!isObject(tag)) return null;
  const name = typeof tag.name === 'string' ? tag.name.trim() : '';
  if (!name) return null;

  return {
    id: typeof tag.id === 'string' && tag.id ? tag.id : generateId(),
    name,
    categoryId: typeof tag.categoryId === 'string' && tag.categoryId.trim() ? tag.categoryId.trim() : null,
  };
}

function dedupeBy(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function buildBackupPayload({ records, categories, tags }) {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    records: records.map((record) => ({ ...record })),
    categories: categories.map((category) => ({ ...category })),
    tags: tags.map((tag) => ({ ...tag })),
  };
}

export function formatBackupSummary(payload) {
  return {
    version: payload.version,
    exportedAt: payload.exportedAt ? formatFullDate(payload.exportedAt) : '--',
    recordCount: payload.records.length,
    categoryCount: payload.categories.length,
    tagCount: payload.tags.length,
  };
}

export function parseBackupFileContent(content) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('备份文件不是合法的 JSON。');
  }

  if (!isObject(parsed)) {
    throw new Error('备份文件结构不正确。');
  }
  if (parsed.version !== BACKUP_VERSION) {
    throw new Error('当前只支持版本 1 的备份文件。');
  }
  if (!Array.isArray(parsed.records) || !Array.isArray(parsed.categories) || !Array.isArray(parsed.tags)) {
    throw new Error('备份文件缺少 records、categories 或 tags 数组。');
  }

  const records = parsed.records.map(normalizeRecord).filter(Boolean);
  const categories = parsed.categories.map(normalizeCategory).filter(Boolean);
  const tags = parsed.tags.map(normalizeTag).filter(Boolean);

  if (records.length !== parsed.records.length) {
    throw new Error('备份文件中的记录数据不完整，无法恢复。');
  }
  if (categories.length !== parsed.categories.length) {
    throw new Error('备份文件中的分类数据不完整，无法恢复。');
  }
  if (tags.length !== parsed.tags.length) {
    throw new Error('备份文件中的标签数据不完整，无法恢复。');
  }

  return {
    version: parsed.version,
    exportedAt: parsed.exportedAt || null,
    records: dedupeBy(records, (item) => item.id),
    categories: dedupeBy(categories, (item) => item.id),
    tags: dedupeBy(tags, (item) => item.id),
  };
}

export function mergeBackupData(currentData, incomingData) {
  const recordIds = new Set(currentData.records.map((item) => item.id));
  const categoryIds = new Set(currentData.categories.map((item) => item.id));
  const categoryKeys = new Set(currentData.categories.map((item) => `${item.type}::${item.name}`));
  const tagIds = new Set(currentData.tags.map((item) => item.id));
  const tagNames = new Set(currentData.tags.map((item) => item.name));

  const addedRecords = [];
  let skippedRecords = 0;
  incomingData.records.forEach((record) => {
    if (recordIds.has(record.id)) {
      skippedRecords += 1;
      return;
    }
    recordIds.add(record.id);
    addedRecords.push(record);
  });

  const addedCategories = [];
  let skippedCategories = 0;
  incomingData.categories.forEach((category) => {
    const key = `${category.type}::${category.name}`;
    if (categoryIds.has(category.id) || categoryKeys.has(key)) {
      skippedCategories += 1;
      return;
    }
    categoryIds.add(category.id);
    categoryKeys.add(key);
    addedCategories.push(category);
  });

  const addedTags = [];
  let skippedTags = 0;
  incomingData.tags.forEach((tag) => {
    if (tagIds.has(tag.id) || tagNames.has(tag.name)) {
      skippedTags += 1;
      return;
    }
    tagIds.add(tag.id);
    tagNames.add(tag.name);
    addedTags.push(tag);
  });

  return {
    data: {
      records: [...currentData.records, ...addedRecords],
      categories: [...currentData.categories, ...addedCategories],
      tags: [...currentData.tags, ...addedTags],
    },
    summary: {
      addedRecords: addedRecords.length,
      skippedRecords,
      addedCategories: addedCategories.length,
      skippedCategories,
      addedTags: addedTags.length,
      skippedTags,
      mode: 'merge',
    },
  };
}

export function replaceBackupData(incomingData) {
  return {
    data: {
      records: incomingData.records,
      categories: incomingData.categories,
      tags: incomingData.tags,
    },
    summary: {
      addedRecords: incomingData.records.length,
      skippedRecords: 0,
      addedCategories: incomingData.categories.length,
      skippedCategories: 0,
      addedTags: incomingData.tags.length,
      skippedTags: 0,
      mode: 'replace',
    },
  };
}
