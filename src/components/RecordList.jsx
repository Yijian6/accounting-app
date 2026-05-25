import { useCallback, useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import TagInput from './TagInput';
import { formatAmount, toDatetimeLocal, isToday, isThisMonth, getDateGroup, getDateKey } from '../utils/format';
import { exportBackupJSON, exportCSV, exportJSON } from '../utils/export';
import { formatBackupSummary, parseBackupFileContent } from '../utils/backup';
import {
  buildSyncPayload,
  fetchSyncStatus,
  getSyncSettings,
  pullSyncSnapshot,
  pushSyncSnapshot,
  saveSyncSettings,
} from '../utils/sync';
import './RecordList.css';

function buildImportResultMessage(summary) {
  if (summary.mode === 'replace') {
    return `已覆盖为 ${summary.addedRecords} 条记录、${summary.addedCategories} 个分类、${summary.addedTags} 个标签。`;
  }

  return `已新增 ${summary.addedRecords} 条记录、${summary.addedCategories} 个分类、${summary.addedTags} 个标签；跳过 ${summary.skippedRecords} 条重复记录、${summary.skippedCategories} 个重复分类、${summary.skippedTags} 个重复标签。`;
}

function normalizeSearchText(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfWeek(date) {
  const day = date.getDay() || 7;
  const start = startOfDay(date);
  start.setDate(start.getDate() - day + 1);
  return start;
}

function endOfWeek(date) {
  const end = startOfWeek(date);
  end.setDate(end.getDate() + 6);
  return endOfDay(end);
}

function getSearchDateRange(query) {
  const text = normalizeSearchText(query).replace(/\s/g, '');
  const now = new Date();

  if (text === '今天') return { start: startOfDay(now), end: endOfDay(now) };
  if (text === '昨天') {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    return { start: startOfDay(date), end: endOfDay(date) };
  }
  if (text === '前天') {
    const date = new Date(now);
    date.setDate(date.getDate() - 2);
    return { start: startOfDay(date), end: endOfDay(date) };
  }
  if (text === '本周') return { start: startOfWeek(now), end: endOfWeek(now) };
  if (text === '上周') {
    const date = new Date(now);
    date.setDate(date.getDate() - 7);
    return { start: startOfWeek(date), end: endOfWeek(date) };
  }
  if (text === '本月') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  if (text === '上月') {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  if (text === '今年') {
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end: endOfDay(new Date(now.getFullYear(), 11, 31)),
    };
  }
  if (text === '去年') {
    return {
      start: new Date(now.getFullYear() - 1, 0, 1),
      end: endOfDay(new Date(now.getFullYear() - 1, 11, 31)),
    };
  }

  const fullDateMatch = text.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/);
  if (fullDateMatch) {
    const [, year, month, day] = fullDateMatch.map(Number);
    const date = new Date(year, month - 1, day);
    if (!Number.isNaN(date.getTime())) return { start: startOfDay(date), end: endOfDay(date) };
  }

  const monthDayMatch = text.match(/^(\d{1,2})(?:[-/.月])(\d{1,2})日?$/);
  if (monthDayMatch) {
    const [, month, day] = monthDayMatch.map(Number);
    const date = new Date(now.getFullYear(), month - 1, day);
    if (!Number.isNaN(date.getTime())) return { start: startOfDay(date), end: endOfDay(date) };
  }

  const yearMonthMatch = text.match(/^(\d{4})年?(\d{1,2})月$/);
  if (yearMonthMatch) {
    const [, year, month] = yearMonthMatch.map(Number);
    return {
      start: new Date(year, month - 1, 1),
      end: endOfDay(new Date(year, month, 0)),
    };
  }

  const monthMatch = text.match(/^(\d{1,2})月$/);
  if (monthMatch) {
    const month = Number(monthMatch[1]);
    return {
      start: new Date(now.getFullYear(), month - 1, 1),
      end: endOfDay(new Date(now.getFullYear(), month, 0)),
    };
  }

  return null;
}

function formatRecordDateTexts(datetime) {
  const date = new Date(datetime);
  if (Number.isNaN(date.getTime())) return [];

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const paddedMonth = String(month).padStart(2, '0');
  const paddedDay = String(day).padStart(2, '0');

  return [
    `${year}-${paddedMonth}-${paddedDay}`,
    `${year}/${paddedMonth}/${paddedDay}`,
    `${paddedMonth}-${paddedDay}`,
    `${month}-${day}`,
    `${month}月${day}`,
    `${month}月`,
    `${year}年${month}月`,
    getDateGroup(datetime),
  ];
}

function recordMatchesSearch(record, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const dateRange = getSearchDateRange(normalizedQuery);
  const recordDate = new Date(record.datetime);
  if (
    dateRange
    && !Number.isNaN(recordDate.getTime())
    && recordDate >= dateRange.start
    && recordDate <= dateRange.end
  ) {
    return true;
  }

  const amount = Number(record.amount);
  const recurrenceLabels = record.recurrence
    ? ['固定', '固定支出', record.recurrence.type === 'yearly' ? '年' : '月']
    : [];
  const fields = [
    record.category,
    record.note,
    record.type === 'income' ? '收入' : '支出',
    Number.isFinite(amount) ? String(amount) : '',
    Number.isFinite(amount) ? formatAmount(amount) : '',
    ...(Array.isArray(record.tags) ? record.tags : []),
    ...recurrenceLabels,
    ...formatRecordDateTexts(record.datetime),
  ];

  return fields.some((field) => normalizeSearchText(field).includes(normalizedQuery));
}

function getRecordSearchMeta(record) {
  const meta = [];
  if (Array.isArray(record.tags) && record.tags.length > 0) {
    meta.push(record.tags.join(' / '));
  }
  if (record.note) {
    meta.push(record.note);
  }
  if (record.recurrence) {
    meta.push(record.recurrence.type === 'yearly' ? '固定支出 · 年' : '固定支出 · 月');
  }
  return meta.join(' · ');
}

export default function RecordList({
  records,
  categories,
  tags,
  snapshot,
  onUpdate,
  onDelete,
  onImportBackup,
  onReplaceAllData,
}) {
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showDataManager, setShowDataManager] = useState(false);
  const [pendingBackup, setPendingBackup] = useState(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [syncSettings, setSyncSettings] = useState(() => getSyncSettings());
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncConflict, setSyncConflict] = useState(null);
  const [showMoreEdit, setShowMoreEdit] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState('');
  const [pressedRecordId, setPressedRecordId] = useState('');
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return new Set([getDateKey(today.toISOString()), getDateKey(yesterday.toISOString())]);
  });
  const [showMoreExport, setShowMoreExport] = useState(false);
  const fileInputRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearLongPressTimer(), [clearLongPressTimer]);

  useEffect(() => {
    if (!deleteTargetId) return undefined;

    const dismissDeleteAction = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.record-row')) return;

      clearLongPressTimer();
      setPressedRecordId('');
      setDeleteTargetId('');
    };

    document.addEventListener('pointerdown', dismissDeleteAction, true);
    return () => {
      document.removeEventListener('pointerdown', dismissDeleteAction, true);
    };
  }, [clearLongPressTimer, deleteTargetId]);

  const todayExpense = records
    .filter((record) => record.type === 'expense' && isToday(record.datetime))
    .reduce((sum, record) => sum + record.amount, 0);
  const todayIncome = records
    .filter((record) => record.type === 'income' && isToday(record.datetime))
    .reduce((sum, record) => sum + record.amount, 0);
  const todayNet = todayIncome - todayExpense;
  const monthExpense = records
    .filter((record) => record.type === 'expense' && isThisMonth(record.datetime))
    .reduce((sum, record) => sum + record.amount, 0);
  const monthIncome = records
    .filter((record) => record.type === 'income' && isThisMonth(record.datetime))
    .reduce((sum, record) => sum + record.amount, 0);
  const monthNet = monthIncome - monthExpense;

  const normalizedSearchQuery = normalizeSearchText(searchQuery);
  const isSearching = normalizedSearchQuery.length > 0;
  const visibleRecords = isSearching
    ? records.filter((record) => recordMatchesSearch(record, normalizedSearchQuery))
    : records;

  const sortedRecords = [...visibleRecords].sort(
    (left, right) => new Date(right.datetime) - new Date(left.datetime)
  );

  const groupedRecords = [];
  let currentKey = '';
  for (const record of sortedRecords) {
    const key = getDateKey(record.datetime);
    if (key !== currentKey) {
      currentKey = key;
      const label = getDateGroup(record.datetime);
      groupedRecords.push({ type: 'header', label, key });
    }
    groupedRecords.push({ type: 'record', ...record });
  }

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isGroupExpanded = (key) => {
    if (isSearching) return true;
    if (expandedGroups.has(key)) return true;
    if (expandedGroups.has('__all__')) return true;
    return false;
  };

  const startEdit = (record) => {
    setDeleteTargetId('');
    setEditingRecord(record);
    setEditForm({
      amount: record.amount.toString(),
      type: record.type,
      category: record.category,
      tags: [...record.tags],
      note: record.note || '',
      datetime: toDatetimeLocal(record.datetime),
      recurrence: record.recurrence || null,
    });
    setShowMoreEdit(false);
  };

  const revealDeleteAction = (record) => {
    longPressTriggeredRef.current = true;
    setPressedRecordId('');
    setDeleteTargetId(record.id);
    if (window.navigator?.vibrate) {
      window.navigator.vibrate(8);
    }
  };

  const startRecordPress = (record, event) => {
    if (event.button && event.button !== 0) return;
    clearLongPressTimer();
    longPressTriggeredRef.current = false;
    setPressedRecordId(record.id);
    longPressTimerRef.current = window.setTimeout(() => {
      revealDeleteAction(record);
    }, 520);
  };

  const endRecordPress = () => {
    clearLongPressTimer();
    setPressedRecordId('');
  };

  const handleRecordClick = (record) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    if (deleteTargetId === record.id) {
      setDeleteTargetId('');
      return;
    }

    startEdit(record);
  };

  const handleRecordDelete = (recordId) => {
    clearLongPressTimer();
    setDeleteTargetId('');
    setPressedRecordId('');
    onDelete(recordId);
  };

  const getAvailableTagsForCategory = (type, categoryName) => {
    if (type !== 'expense' || !categoryName) {
      return [];
    }

    const category = categories.find((item) => item.type === 'expense' && item.name === categoryName);
    if (!category) {
      return [];
    }

    return tags.filter((tag) => tag.categoryId === category.id);
  };

  const saveEdit = () => {
    if (!editForm.amount || !editForm.category) return;
    const allowedTagNames = new Set(filteredEditTags.map((tag) => tag.name));
    const nextTags = editForm.type === 'expense'
      ? editForm.tags.filter((tag) => allowedTagNames.has(tag))
      : [];

    onUpdate(editingRecord.id, {
      ...editForm,
      tags: nextTags,
      amount: parseFloat(editForm.amount),
      datetime: new Date(editForm.datetime).toISOString(),
      recurrence: editForm.type === 'expense' ? editForm.recurrence : null,
    });
    setEditingRecord(null);
  };

  const filteredEditCategories = categories.filter((category) => category.type === editForm.type);
  const filteredEditTags = getAvailableTagsForCategory(editForm.type, editForm.category);

  const openDataManager = () => {
    setImportError('');
    setImportSuccess('');
    setPendingBackup(null);
    setSyncError('');
    setSyncMessage('');
    setSyncConflict(null);
    setSyncSettings(getSyncSettings());
    setShowDataManager(true);
  };

  const closeDataManager = () => {
    setShowDataManager(false);
    setPendingBackup(null);
    setImportError('');
    setSyncError('');
    setSyncMessage('');
    setSyncConflict(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const updateSyncSettings = (patch) => {
    const next = saveSyncSettings({ ...syncSettings, ...patch });
    setSyncSettings(next);
    return next;
  };

  const triggerImport = () => {
    setImportError('');
    setImportSuccess('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleBackupFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError('');
    setImportSuccess('');

    try {
      const content = await file.text();
      const payload = parseBackupFileContent(content);
      setPendingBackup({
        filename: file.name,
        payload,
        summary: formatBackupSummary(payload),
      });
    } catch (error) {
      setPendingBackup(null);
      setImportError(error instanceof Error ? error.message : '导入备份失败。');
    }
  };

  const runImport = (mode) => {
    if (!pendingBackup) return;

    const summary = onImportBackup(pendingBackup.payload, mode);
    setImportSuccess(buildImportResultMessage(summary));
    setImportError('');
    setPendingBackup(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const readSyncStatus = async () => {
    setSyncBusy(true);
    setSyncError('');
    setSyncMessage('');
    setSyncConflict(null);
    try {
      const status = await fetchSyncStatus({
        endpoint: syncSettings.syncEndpoint,
        password: syncSettings.syncPassword,
      });
      setSyncStatus(status);
      if (status.exists) {
        setSyncMessage(`云端已存在数据，revision ${status.revision || '--'}`);
        updateSyncSettings({ syncEnabled: true, lastKnownRevision: status.revision || '' });
      } else {
        setSyncMessage('云端还没有同步数据。');
      }
    } catch (error) {
      setSyncError(error.message || '读取云端状态失败。');
    } finally {
      setSyncBusy(false);
    }
  };

  const executePush = async (force = false) => {
    setSyncBusy(true);
    setSyncError('');
    setSyncMessage('');
    try {
      const payload = buildSyncPayload(snapshot);
      const result = await pushSyncSnapshot({
        endpoint: syncSettings.syncEndpoint,
        password: syncSettings.syncPassword,
        payload,
        baseRevision: syncSettings.lastKnownRevision,
        force,
      });
      setSyncConflict(null);
      setSyncStatus({
        exists: true,
        revision: result.revision,
        updatedAt: result.updatedAt,
      });
      updateSyncSettings({
        syncEnabled: true,
        lastKnownRevision: result.revision,
        lastSyncAt: result.updatedAt,
      });
      setSyncMessage(`已上传到云端，revision ${result.revision}`);
    } catch (error) {
      if (error.code === 'REVISION_CONFLICT') {
        setSyncConflict({
          revision: error.details?.revision || '',
          updatedAt: error.details?.updatedAt || '',
        });
        setSyncError(error.message || '云端版本冲突。');
      } else {
        setSyncError(error.message || '上传到云端失败。');
      }
    } finally {
      setSyncBusy(false);
    }
  };

  const executePull = async () => {
    setSyncBusy(true);
    setSyncError('');
    setSyncMessage('');
    setSyncConflict(null);
    try {
      const result = await pullSyncSnapshot({
        endpoint: syncSettings.syncEndpoint,
        password: syncSettings.syncPassword,
      });
      const summary = onReplaceAllData(result.payload);
      setSyncStatus({
        exists: true,
        revision: result.revision,
        updatedAt: result.updatedAt,
      });
      updateSyncSettings({
        syncEnabled: true,
        lastKnownRevision: result.revision,
        lastSyncAt: result.updatedAt,
      });
      setSyncMessage(`已从云端恢复 ${summary.addedRecords} 条记录。`);
    } catch (error) {
      setSyncError(error.message || '从云端恢复失败。');
    } finally {
      setSyncBusy(false);
    }
  };

  return (
    <div className="record-list">
      <div className="summary-cards">
        <div className="summary-card summary-card-flow">
          <div className="summary-card-head">
            <span className="summary-label">今日净额</span>
            <span className={`summary-value ${todayNet >= 0 ? 'income' : 'expense'}`}>
              {todayNet >= 0 ? '+' : '-'}{formatAmount(Math.abs(todayNet))}
            </span>
          </div>
          <div className="summary-flow-pair">
            <span>
              <small>支出</small>
              <strong className="expense">{formatAmount(todayExpense)}</strong>
            </span>
            <span>
              <small>收入</small>
              <strong className="income">{formatAmount(todayIncome)}</strong>
            </span>
          </div>
        </div>
        <div className="summary-card summary-card-flow">
          <div className="summary-card-head">
            <span className="summary-label">本月净额</span>
            <span className={`summary-value ${monthNet >= 0 ? 'income' : 'expense'}`}>
              {monthNet >= 0 ? '+' : '-'}{formatAmount(Math.abs(monthNet))}
            </span>
          </div>
          <div className="summary-flow-pair">
            <span>
              <small>支出</small>
              <strong className="expense">{formatAmount(monthExpense)}</strong>
            </span>
            <span>
              <small>收入</small>
              <strong className="income">{formatAmount(monthIncome)}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="record-search">
        <label className="record-search-label" htmlFor="record-search-input">搜索记录</label>
        <div className="record-search-input-wrap">
          <svg className="record-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            id="record-search-input"
            type="search"
            value={searchQuery}
            placeholder="输入日期、分类、标签、备注或金额"
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {isSearching && (
            <button
              type="button"
              className="record-search-clear"
              onClick={() => setSearchQuery('')}
            >
              清空
            </button>
          )}
        </div>
        {isSearching && (
          <div className="record-search-status">
            找到 {sortedRecords.length} 条相关记录
          </div>
        )}
      </div>

      <div className="list-actions">
        <button className="manage-icon-btn-inline" onClick={openDataManager} title="数据管理">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {records.length === 0 ? (
        <div className="empty-state">暂无记录</div>
      ) : sortedRecords.length === 0 ? (
        <div className="empty-state search-empty">
          <strong>没有找到相关记录</strong>
          <span>换个日期、分类、标签或备注试试</span>
        </div>
      ) : (
        <div className="records">
          {groupedRecords.map((item) =>
            item.type === 'header' ? (
              <button
                key={item.key}
                className={`date-group-header ${isGroupExpanded(item.key) ? 'expanded' : ''}`}
                onClick={() => toggleGroup(item.key)}
              >
                <span>{item.label}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            ) : (
              isGroupExpanded(getDateKey(item.datetime)) && (
                <div
                  key={item.id}
                  className={`record-row ${deleteTargetId === item.id ? 'delete-open' : ''}`}
                >
                  <button
                    className={`record-item ${pressedRecordId === item.id ? 'pressing' : ''}`}
                    onPointerDown={(event) => startRecordPress(item, event)}
                    onPointerUp={endRecordPress}
                    onPointerCancel={endRecordPress}
                    onPointerLeave={endRecordPress}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      revealDeleteAction(item);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Delete' || event.key === 'Backspace') {
                        event.preventDefault();
                        revealDeleteAction(item);
                      }
                    }}
                    onClick={() => handleRecordClick(item)}
                  >
                    <span className="record-main">
                      <span className="record-category">{item.category}</span>
                      {isSearching && getRecordSearchMeta(item) && (
                        <span className="record-meta">{getRecordSearchMeta(item)}</span>
                      )}
                    </span>
                    <span className={`record-amount ${item.type}`}>
                      {item.type === 'expense' ? '-' : '+'}{formatAmount(item.amount)}
                    </span>
                  </button>
                  {deleteTargetId === item.id && (
                    <button
                      type="button"
                      className="record-delete-btn"
                      onClick={() => handleRecordDelete(item.id)}
                    >
                      删除
                    </button>
                  )}
                </div>
              )
            )
          )}
        </div>
      )}

      <Modal
        open={!!editingRecord}
        title="编辑记录"
        onClose={() => setEditingRecord(null)}
      >
        {editingRecord && (
          <div className="edit-form">
            <div className="edit-type-switch">
              <button
                type="button"
                className={`type-btn ${editForm.type === 'expense' ? 'active expense' : ''}`}
                onClick={() => setEditForm((form) => ({
                  ...form,
                  type: 'expense',
                  category: '',
                  tags: [],
                }))}
              >
                支出
              </button>
              <button
                type="button"
                className={`type-btn ${editForm.type === 'income' ? 'active income' : ''}`}
                onClick={() => setEditForm((form) => ({
                  ...form,
                  type: 'income',
                  category: '',
                  tags: [],
                }))}
              >
                收入
              </button>
            </div>

            <div className="edit-amount-input">
              <span className="amount-symbol">{editForm.type === 'expense' ? '-' : '+'}</span>
              <input
                type="number"
                step="0.01"
                value={editForm.amount}
                onChange={(event) => setEditForm((form) => ({ ...form, amount: event.target.value }))}
              />
            </div>

            <div className="category-grid">
              {filteredEditCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`category-item ${editForm.category === category.name ? 'active' : ''}`}
                  onClick={() => setEditForm((form) => ({ ...form, category: category.name, tags: [] }))}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {editForm.type === 'expense' && (
              <TagInput
                tags={filteredEditTags}
                selectedTags={editForm.tags}
                onChange={(nextTags) => setEditForm((form) => ({ ...form, tags: nextTags }))}
                emptyMessage={editForm.category ? '这个分类下还没有细分标签' : '先选分类，再选细分标签'}
              />
            )}

            <button
              type="button"
              className={`more-toggle ${showMoreEdit ? 'expanded' : ''}`}
              onClick={() => setShowMoreEdit(!showMoreEdit)}
            >
              {showMoreEdit ? '收起' : '更多选项'}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showMoreEdit && (
              <div className="more-section">
                <input
                  type="text"
                  placeholder="添加备注..."
                  value={editForm.note}
                  onChange={(event) => setEditForm((form) => ({ ...form, note: event.target.value }))}
                />
                <input
                  type="datetime-local"
                  value={editForm.datetime}
                  onChange={(event) => setEditForm((form) => ({ ...form, datetime: event.target.value }))}
                />
                {editForm.type === 'expense' && (
                  <div className="edit-fixed-section">
                    <label className="edit-fixed-toggle">
                      <input
                        type="checkbox"
                        checked={!!editForm.recurrence}
                        onChange={(event) => setEditForm((form) => ({
                          ...form,
                          recurrence: event.target.checked ? { type: form.recurrence?.type || 'monthly' } : null,
                        }))}
                      />
                      <span>这是固定支出</span>
                    </label>
                    {editForm.recurrence && (
                      <div className="edit-recurrence-switch">
                        <button
                          type="button"
                          className={editForm.recurrence.type === 'monthly' ? 'active' : ''}
                          onClick={() => setEditForm((form) => ({ ...form, recurrence: { type: 'monthly' } }))}
                        >
                          月
                        </button>
                        <button
                          type="button"
                          className={editForm.recurrence.type === 'yearly' ? 'active' : ''}
                          onClick={() => setEditForm((form) => ({ ...form, recurrence: { type: 'yearly' } }))}
                        >
                          年
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <button className="submit-btn" onClick={saveEdit}>
              保存
            </button>
          </div>
        )}
      </Modal>

      <Modal
        open={showDataManager}
        title="数据管理"
        onClose={closeDataManager}
      >
        <div className="data-manager">
          <input
            ref={fileInputRef}
            className="file-input-hidden"
            type="file"
            accept="application/json,.json"
            onChange={handleBackupFileChange}
          />

          <div className="data-manager-section">
            <button
              className="export-option-btn"
              onClick={() => exportBackupJSON({ records, categories, tags })}
            >
              导出备份
            </button>
            <button
              className="export-option-btn secondary"
              onClick={triggerImport}
            >
              导入备份
            </button>
          </div>

          {importError && (
            <div className="import-status error">{importError}</div>
          )}

          {importSuccess && (
            <div className="import-status success">{importSuccess}</div>
          )}

          {pendingBackup && (
            <div className="import-preview">
              <div className="import-preview-head">
                <strong>准备导入备份</strong>
                <span>{pendingBackup.filename}</span>
              </div>
              <div className="import-summary-grid">
                <div className="import-summary-item">
                  <span>版本</span>
                  <strong>{pendingBackup.summary.version}</strong>
                </div>
                <div className="import-summary-item">
                  <span>导出时间</span>
                  <strong>{pendingBackup.summary.exportedAt}</strong>
                </div>
                <div className="import-summary-item">
                  <span>记录数</span>
                  <strong>{pendingBackup.summary.recordCount}</strong>
                </div>
                <div className="import-summary-item">
                  <span>分类数</span>
                  <strong>{pendingBackup.summary.categoryCount}</strong>
                </div>
                <div className="import-summary-item">
                  <span>标签数</span>
                  <strong>{pendingBackup.summary.tagCount}</strong>
                </div>
              </div>

              <div className="import-warning">
                <strong>覆盖模式会替换当前本地数据。</strong>
                <span>执行覆盖前，建议先导出一份当前备份。</span>
              </div>

              <div className="import-actions">
                <button
                  className="export-option-btn secondary"
                  onClick={() => runImport('merge')}
                >
                  合并到当前数据
                </button>
                <button
                  className="export-option-btn danger"
                  onClick={() => runImport('replace')}
                >
                  覆盖当前数据
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            className={`more-toggle ${showMoreExport ? 'expanded' : ''}`}
            onClick={() => setShowMoreExport(!showMoreExport)}
          >
            {showMoreExport ? '收起' : '更多选项'}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showMoreExport && (
          <>
          <div className="data-manager-divider" />

          <div className="data-manager-section">
            <button
              className="export-option-btn secondary"
              onClick={() => exportCSV(records)}
            >
              导出 CSV
            </button>
            <button
              className="export-option-btn secondary"
              onClick={() => exportJSON(records)}
            >
              导出展示 JSON
            </button>
          </div>

          <div className="data-manager-divider" />

          <div className="data-manager-section">
            <div className="sync-section-head">
              <strong>云端同步</strong>
              <span>Cloudflare Worker + D1</span>
            </div>

            <div className="sync-field">
              <label>同步 API 地址</label>
              <input
                type="text"
                placeholder="https://your-sync-worker.workers.dev"
                value={syncSettings.syncEndpoint}
                onChange={(event) => updateSyncSettings({ syncEndpoint: event.target.value })}
              />
            </div>

            <div className="sync-field">
              <label>同步密码</label>
              <input
                type="password"
                placeholder="输入你自己的同步密码"
                value={syncSettings.syncPassword}
                onChange={(event) => updateSyncSettings({ syncPassword: event.target.value })}
              />
            </div>

            <div className="sync-actions">
              <button
                className="export-option-btn secondary"
                disabled={syncBusy || !syncSettings.syncEndpoint || !syncSettings.syncPassword}
                onClick={readSyncStatus}
              >
                {syncBusy ? '处理中...' : '查看云端状态'}
              </button>
              <button
                className="export-option-btn secondary"
                disabled={syncBusy || !syncSettings.syncEndpoint || !syncSettings.syncPassword}
                onClick={() => executePush(false)}
              >
                上传到云端
              </button>
              <button
                className="export-option-btn secondary"
                disabled={syncBusy || !syncSettings.syncEndpoint || !syncSettings.syncPassword}
                onClick={executePull}
              >
                从云端恢复
              </button>
            </div>

            {!syncSettings.syncPassword && (
              <div className="sync-hint">输入同步密码后，云端操作按钮才会生效。</div>
            )}

            {syncStatus && (
              <div className="sync-status-card">
                <span>云端 revision：{syncStatus.revision || '--'}</span>
                <span>云端更新时间：{syncStatus.updatedAt || '--'}</span>
                <span>本地已知 revision：{syncSettings.lastKnownRevision || '--'}</span>
              </div>
            )}

            {syncMessage && (
              <div className="import-status success">{syncMessage}</div>
            )}

            {syncError && (
              <div className="import-status error">{syncError}</div>
            )}

            {syncConflict && (
              <div className="sync-conflict">
                <strong>云端版本比本地已知版本更新</strong>
                <span>云端 revision：{syncConflict.revision || '--'}</span>
                <span>云端更新时间：{syncConflict.updatedAt || '--'}</span>
                <button
                  className="export-option-btn danger"
                  disabled={syncBusy}
                  onClick={() => executePush(true)}
                >
                  强制上传覆盖云端
                </button>
              </div>
            )}
          </div>
          </>
          )}
        </div>
      </Modal>
    </div>
  );
}
