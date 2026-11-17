/**
 * 去向（categories）与细分（tags）的改名、合并、转移、删除。
 *
 * 全是纯函数：输入 { records, categories, tags }，返回新的 { data, message } 或 { error }。
 * 记录里存的是去向名和细分名，所以所有操作最后都落到「把一批记录从 A 改到 B」。
 * 数据结构不变。
 */
import { generateId } from './format';

export const NAME_MAX = 12;

const PREFERRED_ORDER = {
  expense: ['餐饮', '交通', '咖啡', '购物', '订阅', '日用', '娱乐'],
  income: ['工资', '兼职', '理财'],
};
const TRAILING_NAME = '其他';

const unique = (list) => list.filter((item, index) => item && list.indexOf(item) === index);

export function cleanName(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function nameError(name) {
  if (!name) return '名字不能为空';
  if ([...name].length > NAME_MAX) return `名字最多 ${NAME_MAX} 个字`;
  return '';
}

/** 同名去向只留一个；常用去向排前面，「其他」放最后，其余保持用户自己的顺序 */
export function orderDestinations(items, type) {
  const seen = new Set();
  const list = items.filter((item) => {
    if (!item.name || seen.has(item.name)) return false;
    seen.add(item.name);
    return true;
  });
  const preferred = PREFERRED_ORDER[type] || [];
  const rank = (item) => {
    if (item.name === TRAILING_NAME) return Number.MAX_SAFE_INTEGER;
    const index = preferred.indexOf(item.name);
    return index === -1 ? preferred.length : index;
  };
  return list
    .map((item, index) => ({ item, index }))
    .sort((left, right) => (rank(left.item) - rank(right.item)) || (left.index - right.index))
    .map(({ item }) => item);
}

/** 按「类型 + 去向名」「去向名 + 细分名」数记录；不在细分列表里的旧名字也算 */
export function usageCounter(records) {
  const byCategory = new Map();
  const byTag = new Map();
  records.forEach((record) => {
    const categoryKey = `${record.type}\u0000${record.category}`;
    byCategory.set(categoryKey, (byCategory.get(categoryKey) || 0) + 1);
    if (record.type !== 'expense' || !Array.isArray(record.tags)) return;
    unique(record.tags).forEach((name) => {
      const tagKey = `${record.category}\u0000${name}`;
      byTag.set(tagKey, (byTag.get(tagKey) || 0) + 1);
    });
  });
  return {
    category: (category) => (category ? byCategory.get(`${category.type}\u0000${category.name}`) || 0 : 0),
    tag: (categoryName, tagName) => byTag.get(`${categoryName}\u0000${tagName}`) || 0,
  };
}

/** 有效去向下的细分之外，都算「未归属」 */
export function orphanTags(data) {
  const expenseIds = new Set(data.categories.filter((item) => item.type === 'expense').map((item) => item.id));
  return data.tags.filter((tag) => !tag.categoryId || !expenseIds.has(tag.categoryId));
}

const findCategory = (data, id) => data.categories.find((item) => item.id === id) || null;
const findTag = (data, id) => data.tags.find((item) => item.id === id) || null;

/** 同类型下与 name 重名的另一个去向 */
export function categoryConflict(data, id, name) {
  const category = findCategory(data, id);
  if (!category) return null;
  return data.categories.find((item) => item.id !== id && item.type === category.type && item.name === name) || null;
}

/** 同一去向下与 name 重名的另一个细分 */
export function tagConflict(data, id, name) {
  const tag = findTag(data, id);
  if (!tag) return null;
  return data.tags.find((item) => item.id !== id && item.categoryId === tag.categoryId && item.name === name) || null;
}

// ── 去向 ──

export function addCategory(data, rawName, type) {
  const name = cleanName(rawName);
  const error = nameError(name);
  if (error) return { error };
  if (data.categories.some((item) => item.type === type && item.name === name)) {
    return { error: `已经有「${name}」了` };
  }
  return {
    data: { ...data, categories: [...data.categories, { id: generateId(), name, type }] },
    message: `已添加「${name}」`,
  };
}

/** 把 source 并入 target：记录改到 target，细分挂到 target（同名合并），source 移除 */
export function mergeCategory(data, sourceId, targetId) {
  const source = findCategory(data, sourceId);
  const target = findCategory(data, targetId);
  if (!source || !target || source.id === target.id || source.type !== target.type) {
    return { error: '没有找到要合并的去向' };
  }

  let moved = 0;
  const records = data.records.map((record) => {
    if (record.type !== source.type || record.category !== source.name) return record;
    moved += 1;
    return { ...record, category: target.name, tags: unique(record.tags || []) };
  });

  const targetTagNames = new Set(data.tags.filter((tag) => tag.categoryId === target.id).map((tag) => tag.name));
  const tags = data.tags
    .filter((tag) => !(tag.categoryId === source.id && targetTagNames.has(tag.name)))
    .map((tag) => (tag.categoryId === source.id ? { ...tag, categoryId: target.id } : tag));

  return {
    data: { records, categories: data.categories.filter((item) => item.id !== source.id), tags },
    message: moved > 0
      ? `「${source.name}」的 ${moved} 笔已并入「${target.name}」`
      : `「${source.name}」已并入「${target.name}」`,
  };
}

/** 改名；若同类型下已有这个名字，就并入那个去向 */
export function renameCategory(data, id, rawName) {
  const category = findCategory(data, id);
  if (!category) return { error: '没有找到这个去向' };
  const name = cleanName(rawName);
  const error = nameError(name);
  if (error) return { error };
  if (name === category.name) return { data, message: '', unchanged: true };

  const conflict = categoryConflict(data, id, name);
  if (conflict) return mergeCategory(data, id, conflict.id);

  return {
    data: {
      ...data,
      categories: data.categories.map((item) => (item.id === id ? { ...item, name } : item)),
      records: data.records.map((record) => (
        record.type === category.type && record.category === category.name ? { ...record, category: name } : record
      )),
    },
    message: `已改名为「${name}」`,
  };
}

/**
 * 删除去向。有记录时必须给 targetId（同类型），等同于并入 target。
 * 每种类型至少留一个，否则没法记账。
 */
export function deleteCategory(data, id, targetId = null) {
  const category = findCategory(data, id);
  if (!category) return { error: '没有找到这个去向' };
  const siblings = data.categories.filter((item) => item.type === category.type && item.id !== id);
  if (siblings.length === 0) {
    return { error: `至少要留一个${category.type === 'expense' ? '去向' : '来源'}` };
  }

  const used = usageCounter(data.records).category(category);
  if (used > 0) {
    if (!targetId) return { error: '这个去向还有记录，先选一个去向转过去', needsTransfer: true };
    const merged = mergeCategory(data, id, targetId);
    if (merged.error) return merged;
    const target = findCategory(data, targetId);
    return { ...merged, message: `已把 ${used} 笔转到「${target.name}」，并删除「${category.name}」` };
  }

  return {
    data: {
      ...data,
      categories: data.categories.filter((item) => item.id !== id),
      // 没有记录的去向，它的细分也不可能被用过，一起删掉
      tags: data.tags.filter((tag) => tag.categoryId !== id),
    },
    message: `已删除「${category.name}」`,
  };
}

// ── 细分 ──

export function addTag(data, rawName, categoryId) {
  const name = cleanName(rawName);
  const error = nameError(name);
  if (error) return { error };
  if (!findCategory(data, categoryId)) return { error: '没有找到这个去向' };
  const existing = data.tags.find((tag) => tag.categoryId === categoryId && tag.name === name);
  if (existing) return { data, message: '', tag: existing, unchanged: true };
  const tag = { id: generateId(), name, categoryId };
  return { data: { ...data, tags: [...data.tags, tag] }, message: `已添加「${name}」`, tag };
}

/** 把细分 source 并入同一去向下的 target：记录上的名字换成 target，source 移除 */
export function mergeTag(data, sourceId, targetId) {
  const source = findTag(data, sourceId);
  const target = findTag(data, targetId);
  if (!source || !target || source.id === target.id) return { error: '没有找到要合并的细分' };
  const category = findCategory(data, source.categoryId);

  let moved = 0;
  const records = category
    ? data.records.map((record) => {
      if (record.type !== 'expense' || record.category !== category.name || !record.tags?.includes(source.name)) {
        return record;
      }
      moved += 1;
      return { ...record, tags: unique(record.tags.map((name) => (name === source.name ? target.name : name))) };
    })
    : data.records;

  return {
    data: { ...data, records, tags: data.tags.filter((tag) => tag.id !== source.id) },
    message: moved > 0 ? `「${source.name}」的 ${moved} 笔已并入「${target.name}」` : `「${source.name}」已并入「${target.name}」`,
    result: { categoryName: category?.name || '', tagName: target.name },
  };
}

/** 改名；若同一去向下已有这个名字，就并入那个细分 */
export function renameTag(data, id, rawName) {
  const tag = findTag(data, id);
  if (!tag) return { error: '没有找到这个细分' };
  const name = cleanName(rawName);
  const error = nameError(name);
  if (error) return { error };
  if (name === tag.name) return { data, message: '', unchanged: true };

  const conflict = tagConflict(data, id, name);
  if (conflict) return mergeTag(data, id, conflict.id);

  const category = findCategory(data, tag.categoryId);
  return {
    data: {
      ...data,
      tags: data.tags.map((item) => (item.id === id ? { ...item, name } : item)),
      records: category
        ? data.records.map((record) => (
          record.type === 'expense' && record.category === category.name && record.tags?.includes(tag.name)
            ? { ...record, tags: unique(record.tags.map((item) => (item === tag.name ? name : item))) }
            : record
        ))
        : data.records,
    },
    message: `已改名为「${name}」`,
    result: { categoryName: category?.name || '', tagName: name },
  };
}

/**
 * 删除细分。有记录用过时必须给 destination：
 * { categoryId, tagName }，tagName 为空表示「不分细分」；categoryId 不同则这些记录换去向。
 * tagName 是还不存在的名字时，会在目标去向下新建。
 */
export function deleteTag(data, id, destination = null) {
  const tag = findTag(data, id);
  if (!tag) return { error: '没有找到这个细分' };
  const category = findCategory(data, tag.categoryId);
  const used = category ? usageCounter(data.records).tag(category.name, tag.name) : 0;

  if (used === 0) {
    return {
      data: { ...data, tags: data.tags.filter((item) => item.id !== id) },
      message: `已删除「${tag.name}」`,
      result: { categoryName: category?.name || '', tagName: '' },
    };
  }

  if (!destination) return { error: '这个细分还有记录，先安排它们的去处', needsTransfer: true };
  const target = findCategory(data, destination.categoryId);
  if (!target || target.type !== 'expense') return { error: '没有找到要转去的去向' };
  const tagName = cleanName(destination.tagName);
  if (tagName) {
    const error = nameError(tagName);
    if (error) return { error };
  }
  if (target.id === category.id && tagName === tag.name) return { error: '不能转给它自己' };

  let tags = data.tags.filter((item) => item.id !== id);
  if (tagName && !tags.some((item) => item.categoryId === target.id && item.name === tagName)) {
    tags = [...tags, { id: generateId(), name: tagName, categoryId: target.id }];
  }

  const records = data.records.map((record) => {
    if (record.type !== 'expense' || record.category !== category.name || !record.tags?.includes(tag.name)) {
      return record;
    }
    if (target.id === category.id) {
      return { ...record, tags: unique(record.tags.map((name) => (name === tag.name ? tagName : name))) };
    }
    // 换了去向：原去向的细分都不再适用
    return { ...record, category: target.name, tags: tagName ? [tagName] : [] };
  });

  const where = tagName ? `「${target.name} · ${tagName}」` : `「${target.name}」`;
  return {
    data: { ...data, records, tags },
    message: `已把 ${used} 笔转到${where}，并删除「${tag.name}」`,
    result: { categoryName: target.name, tagName },
  };
}

/** 未归属的细分收进某个去向；那里已有同名的就直接合并（未归属细分不关联任何记录） */
export function adoptTag(data, id, categoryId) {
  const tag = findTag(data, id);
  const category = findCategory(data, categoryId);
  if (!tag || !category) return { error: '没有找到这个细分' };
  const existing = data.tags.find((item) => item.id !== id && item.categoryId === categoryId && item.name === tag.name);
  return {
    data: {
      ...data,
      tags: existing
        ? data.tags.filter((item) => item.id !== id)
        : data.tags.map((item) => (item.id === id ? { ...item, categoryId } : item)),
    },
    message: `「${tag.name}」已收进「${category.name}」`,
  };
}
