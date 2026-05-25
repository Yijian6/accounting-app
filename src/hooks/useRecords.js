import { useState, useEffect, useCallback } from 'react';
import { getStorage, setStorage } from '../utils/storage';
import { generateId } from '../utils/format';

const STORAGE_KEY = 'accounting_records';

const LEGACY_TEXT_MAP = {
  '鏃╅': '早餐',
  '鍗堥': '午餐',
  '鏅氶': '晚餐',
  '闆堕': '零食',
  '楗枡': '饮料',
  '椁愰ギ': '餐饮',
  '娲楁荡': '洗浴',
  '浜ら€?': '交通',
  '绀句氦': '社交',
  '宸ヨ祫': '工资',
  '鍏艰亴': '兼职',
  '鐞嗚储': '理财',
  '鍏朵粬': '其他',
};

function normalizeText(value) {
  if (typeof value !== 'string') {
    return value;
  }

  return LEGACY_TEXT_MAP[value] || value;
}

function normalizeRecurrence(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  if (value.type !== 'monthly' && value.type !== 'yearly') {
    return null;
  }

  return { type: value.type };
}

function normalizeRecord(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const amount = Number(record.amount);

  return {
    id: typeof record.id === 'string' && record.id ? record.id : generateId(),
    amount: Number.isFinite(amount) ? amount : 0,
    type: record.type === 'income' ? 'income' : 'expense',
    category: normalizeText(record.category || ''),
    tags: Array.isArray(record.tags) ? record.tags.map(normalizeText).filter(Boolean) : [],
    note: typeof record.note === 'string' ? record.note : '',
    datetime: record.datetime || new Date().toISOString(),
    recurrence: normalizeRecurrence(record.recurrence),
  };
}

function normalizeRecords(records) {
  return records.map(normalizeRecord).filter(Boolean);
}

export function useRecords() {
  const [records, setRecords] = useState(() => {
    const stored = getStorage(STORAGE_KEY, []);
    return Array.isArray(stored) ? normalizeRecords(stored) : [];
  });

  useEffect(() => {
    setStorage(STORAGE_KEY, records);
  }, [records]);

  const addRecord = useCallback((data) => {
    const record = normalizeRecord({
      id: generateId(),
      amount: parseFloat(data.amount),
      type: data.type,
      category: data.category,
      tags: data.tags || [],
      note: data.note || '',
      datetime: data.datetime || new Date().toISOString(),
      recurrence: data.recurrence || null,
    });

    setRecords((prev) => [record, ...prev]);
    return record;
  }, []);

  const updateRecord = useCallback((id, data) => {
    setRecords((prev) => prev.map((record) => (
      record.id === id
        ? normalizeRecord({
          ...record,
          ...data,
          amount: parseFloat(data.amount || record.amount),
        })
        : record
    )));
  }, []);

  const deleteRecord = useCallback((id) => {
    setRecords((prev) => prev.filter((record) => record.id !== id));
  }, []);

  const replaceRecords = useCallback((nextRecords) => {
    setRecords(Array.isArray(nextRecords) ? normalizeRecords(nextRecords) : []);
  }, []);

  return { records, addRecord, updateRecord, deleteRecord, replaceRecords };
}
