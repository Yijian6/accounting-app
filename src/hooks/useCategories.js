import { useState, useEffect, useCallback } from 'react';
import { getStorage, setStorage } from '../utils/storage';
import { generateId } from '../utils/format';

const STORAGE_KEY = 'accounting_categories';

const DEFAULT_CATEGORIES = [
  { id: 'cat_food', name: '餐饮', type: 'expense' },
  { id: 'cat_bath', name: '洗浴', type: 'expense' },
  { id: 'cat_ai', name: 'AI', type: 'expense' },
  { id: 'cat_transport', name: '交通', type: 'expense' },
  { id: 'cat_social', name: '社交', type: 'expense' },
  { id: 'cat_salary', name: '工资', type: 'income' },
  { id: 'cat_parttime', name: '兼职', type: 'income' },
  { id: 'cat_finance', name: '理财', type: 'income' },
  { id: 'cat_other', name: '其他', type: 'income' },
];

const LEGACY_CATEGORY_NAME_MAP = {
  '椁愰ギ': '餐饮',
  '娲楁荡': '洗浴',
  '浜ら€?': '交通',
  '绀句氦': '社交',
  '宸ヨ祫': '工资',
  '鍏艰亴': '兼职',
  '鐞嗚储': '理财',
  '鍏朵粬': '其他',
};

const CATEGORY_ID_NAME_MAP = Object.fromEntries(
  DEFAULT_CATEGORIES.map((category) => [category.id, category.name])
);

function normalizeCategory(category) {
  if (!category || typeof category !== 'object') {
    return null;
  }

  const id = typeof category.id === 'string' && category.id ? category.id : generateId();
  const fallbackName = CATEGORY_ID_NAME_MAP[id];
  const rawName = typeof category.name === 'string' ? category.name : '';
  const mappedName = LEGACY_CATEGORY_NAME_MAP[rawName];
  const name = mappedName || rawName || fallbackName;

  if (typeof name !== 'string' || !name.trim()) {
    return null;
  }

  return {
    id,
    name: name.trim(),
    type: category.type === 'income' ? 'income' : 'expense',
  };
}

function normalizeCategories(categories) {
  return categories.map(normalizeCategory).filter(Boolean);
}

export function useCategories() {
  const [categories, setCategories] = useState(() => {
    const stored = getStorage(STORAGE_KEY, null);
    if (Array.isArray(stored)) {
      return normalizeCategories(stored);
    }

    setStorage(STORAGE_KEY, DEFAULT_CATEGORIES);
    return DEFAULT_CATEGORIES;
  });

  useEffect(() => {
    setStorage(STORAGE_KEY, categories);
  }, [categories]);

  const addCategory = useCallback((name, type) => {
    const category = { id: generateId(), name, type };
    setCategories((prev) => [...prev, category]);
    return category;
  }, []);

  const updateCategory = useCallback((id, name) => {
    setCategories((prev) => prev.map((category) => (category.id === id ? { ...category, name } : category)));
  }, []);

  const deleteCategory = useCallback((id) => {
    setCategories((prev) => prev.filter((category) => category.id !== id));
  }, []);

  const replaceCategories = useCallback((nextCategories) => {
    setCategories(Array.isArray(nextCategories) ? normalizeCategories(nextCategories) : []);
  }, []);

  const getCategoriesByType = useCallback(
    (type) => categories.filter((category) => category.type === type),
    [categories]
  );

  return { categories, addCategory, updateCategory, deleteCategory, replaceCategories, getCategoriesByType };
}
