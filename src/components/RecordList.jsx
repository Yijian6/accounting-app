import { useCallback, useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import DataBookExport from './DataBookExport';
import RecordEditor from './RecordEditor';
import SpendCalendar from './SpendCalendar';
import { formatAmount, toDatetimeLocal, getDateGroup, getDateKey } from '../utils/format';
import { exportBackupJSON, exportCSV, exportJSON } from '../utils/export';
import { SAVE_RESULT } from '../utils/saveFile';
import { formatBackupSummary, getBackupMonths, parseBackupFileContent } from '../utils/backup';
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

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
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
  const recurrenceLabel = record.type === 'income' ? '周期收入' : '周期支出';
  const recurrenceLabels = record.recurrence
    ? [
      '周期',
      '固定',
      recurrenceLabel,
      record.type === 'income' ? '固定收入' : '固定支出',
      record.recurrence.type === 'yearly' ? '年' : '月',
    ]
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
    const label = record.type === 'income' ? '周期收入' : '周期支出';
    meta.push(record.recurrence.type === 'yearly' ? `${label} · 年` : `${label} · 月`);
  }
  return meta.join(' · ');
}

function getReviewRange(mode, date) {
  if (mode === 'all') return null;

  if (mode === 'month') {
    const start = getMonthStart(date);
    return {
      start,
      endExclusive: new Date(start.getFullYear(), start.getMonth() + 1, 1),
    };
  }

  const start = startOfDay(date);
  return {
    start,
    endExclusive: addDays(start, 1),
  };
}

function isRecordInPaymentRange(record, range) {
  if (!range) return true;
  const date = new Date(record.datetime);
  if (Number.isNaN(date.getTime())) return false;
  return date >= range.start && date < range.endExclusive;
}

function sumPaymentRecordsInRange(records, type, range) {
  return records
    .filter((record) => record.type === type && isRecordInPaymentRange(record, range))
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);
}

function countRecordsInRange(records, range) {
  return records.filter((record) => isRecordInPaymentRange(record, range)).length;
}

function formatReviewLabel(mode, date) {
  if (mode === 'all') return '全部记录';
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  if (mode === 'month') {
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  }
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`;
}

function isCurrentOrFutureReview(mode, date) {
  const now = new Date();
  if (mode === 'month') {
    return getMonthStart(date).getTime() >= getMonthStart(now).getTime();
  }
  return startOfDay(date).getTime() >= startOfDay(now).getTime();
}

function buildReviewDateTime(date) {
  const now = new Date();
  const target = new Date(date);
  target.setHours(now.getHours(), now.getMinutes(), 0, 0);
  return toDatetimeLocal(target.toISOString());
}

export default function RecordList({
  records,
  categories,
  tags,
  onAdd,
  onUpdate,
  onDelete,
  onImportBackup,
  tagActions,
  onOrganize,
}) {
  const [editingRecord, setEditingRecord] = useState(null);
  const [creatingRecord, setCreatingRecord] = useState(false);
  // 每次打开补记 / 编辑都换一个 key，让浮层重新取初值
  const [editorSession, setEditorSession] = useState(0);
  const [showDataManager, setShowDataManager] = useState(false);
  const [pendingBackup, setPendingBackup] = useState(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [exportSuccess, setExportSuccess] = useState('');
  const [backupMonth, setBackupMonth] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewMode, setReviewMode] = useState('day');
  const [reviewDate, setReviewDate] = useState(() => new Date());
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
  const exportSuccessTimerRef = useRef(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarSession, setCalendarSession] = useState(0);
  // 日历按天看还是按去向（圆环）看；这次打开期间记住上次的选择
  const [calendarView, setCalendarView] = useState('grid');

  useEffect(() => () => {
    if (exportSuccessTimerRef.current) {
      clearTimeout(exportSuccessTimerRef.current);
    }
  }, []);
  const touchStartXRef = useRef(null);
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

  const reviewRange = getReviewRange(reviewMode, reviewDate);
  const reviewExpense = sumPaymentRecordsInRange(records, 'expense', reviewRange);
  const reviewIncome = sumPaymentRecordsInRange(records, 'income', reviewRange);
  const reviewCount = countRecordsInRange(records, reviewRange);
  const reviewLabel = formatReviewLabel(reviewMode, reviewDate);

  const normalizedSearchQuery = normalizeSearchText(searchQuery);
  const isSearching = normalizedSearchQuery.length > 0;
  // 「日」下搜索放到全部记录里找（一天的数据太少，没必要只搜当天）；「月」下仍只搜这个月
  const searchRange = reviewMode === 'month' ? reviewRange : null;
  const visibleRecords = isSearching
    ? records.filter((record) => isRecordInPaymentRange(record, searchRange)
      && recordMatchesSearch(record, normalizedSearchQuery))
    : records.filter((record) => isRecordInPaymentRange(record, reviewRange));

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
  const showDateGroupHeaders = reviewMode === 'all' || isSearching;

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
    if (!showDateGroupHeaders) return true;
    if (isSearching) return true;
    if (expandedGroups.has(key)) return true;
    if (expandedGroups.has('__all__')) return true;
    return false;
  };

  const shiftReview = (direction) => {
    if (reviewMode === 'all') return;
    setReviewDate((date) => {
      const next = reviewMode === 'month'
        ? addMonths(date, direction)
        : addDays(date, direction);
      if (direction > 0 && isCurrentOrFutureReview(reviewMode, date)) {
        return date;
      }
      return next;
    });
  };

  const selectReviewMode = (mode) => {
    setReviewMode(mode);
    setSearchQuery('');
  };

  // 每次打开都重新挂载日历，让它从当前回看的那个月开始
  const openCalendar = () => {
    setCalendarSession((value) => value + 1);
    setCalendarOpen(true);
  };

  const pickCalendarDay = (date) => {
    setReviewMode('day');
    setReviewDate(date);
    setSearchQuery('');
    setCalendarOpen(false);
  };

  const handleTouchStart = (event) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event) => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX == null || reviewMode === 'all') return;
    const endX = event.changedTouches[0]?.clientX ?? startX;
    const delta = endX - startX;
    if (Math.abs(delta) < 48) return;
    shiftReview(delta > 0 ? -1 : 1);
  };

  const startEdit = (record) => {
    setDeleteTargetId('');
    setEditorSession((value) => value + 1);
    setEditingRecord(record);
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

  const openCreateForReviewDay = () => {
    setEditorSession((value) => value + 1);
    setCreatingRecord(true);
  };

  const saveCreate = (data) => {
    if (!onAdd) return;
    onAdd(data);
    const date = new Date(data.datetime);
    setReviewMode('day');
    setReviewDate(date);
    setSearchQuery('');
    setCreatingRecord(false);
  };

  const saveEdit = (data) => {
    if (!editingRecord) return;
    onUpdate(editingRecord.id, data);
    setEditingRecord(null);
  };

  const openDataManager = () => {
    setImportError('');
    setImportSuccess('');
    setPendingBackup(null);
    setShowDataManager(true);
  };

  const closeDataManager = () => {
    setShowDataManager(false);
    setPendingBackup(null);
    setImportError('');
    setExportSuccess('');
    if (exportSuccessTimerRef.current) {
      clearTimeout(exportSuccessTimerRef.current);
      exportSuccessTimerRef.current = null;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const showExportSuccess = (message) => {
    setExportSuccess(message);
    if (exportSuccessTimerRef.current) {
      clearTimeout(exportSuccessTimerRef.current);
    }
    exportSuccessTimerRef.current = setTimeout(() => {
      setExportSuccess('');
      exportSuccessTimerRef.current = null;
    }, 3000);
  };

  // task 必须同步发起保存（iOS 分享面板要求在点击的同步调用链里打开）
  const runExport = async (label, task) => {
    setImportError('');
    setImportSuccess('');
    setExportSuccess('');
    try {
      const result = await task();
      if (result === SAVE_RESULT.SAVED) {
        showExportSuccess(`${label}已保存。`);
      } else if (result === SAVE_RESULT.DOWNLOADED) {
        showExportSuccess(`${label}已导出，请在下载中查收。`);
      }
    } catch {
      setImportError(`${label}这次没有导出成功，可以再试一次。`);
    }
  };

  const backupMonths = showDataManager ? getBackupMonths(records) : [];
  const currentYear = new Date().getFullYear();
  const formatBackupMonth = (item) => (
    item.year === currentYear ? `${item.month} 月` : `${item.year} 年 ${item.month} 月`
  );
  const selectedBackupMonth = backupMonths.find((item) => item.key === backupMonth) || null;

  const handleExportBackup = () => {
    if (selectedBackupMonth) {
      const label = `${formatBackupMonth(selectedBackupMonth)}备份`;
      return runExport(label, () => exportBackupJSON(
        { records, categories, tags },
        { monthKey: selectedBackupMonth.key },
      ));
    }
    return runExport('备份', () => exportBackupJSON({ records, categories, tags }));
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

  return (
    <div className="record-list">
      <section
        className="time-review-card"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="time-review-top">
          <span>时间回顾</span>
          <div className="review-mode-switch" aria-label="回顾范围">
            <button
              type="button"
              className={reviewMode === 'day' ? 'active' : ''}
              onClick={() => selectReviewMode('day')}
            >
              日
            </button>
            <button
              type="button"
              className={reviewMode === 'month' ? 'active' : ''}
              onClick={() => selectReviewMode('month')}
            >
              月
            </button>
            <button
              type="button"
              className={reviewMode === 'all' ? 'active' : ''}
              onClick={() => selectReviewMode('all')}
            >
              全部
            </button>
          </div>
        </div>

        <div className="time-review-nav">
          <button
            type="button"
            className="time-review-arrow"
            disabled={reviewMode === 'all'}
            onClick={() => shiftReview(-1)}
            aria-label="上一段时间"
          >
            ‹
          </button>
          <button
            type="button"
            className="time-review-title"
            onClick={openCalendar}
            disabled={reviewMode === 'all'}
            aria-label={`${reviewLabel}，打开花销日历`}
          >
            {reviewLabel}
            <svg className="time-review-cal-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4.5" width="18" height="16.5" rx="3" />
              <path d="M8 2.5v4M16 2.5v4M3 10h18" />
            </svg>
          </button>
          <button
            type="button"
            className="time-review-arrow"
            disabled={reviewMode === 'all' || isCurrentOrFutureReview(reviewMode, reviewDate)}
            onClick={() => shiftReview(1)}
            aria-label="下一段时间"
          >
            ›
          </button>
        </div>

        <div className="time-review-metrics">
          <span>
            <small>支出</small>
            <strong className="expense">{formatAmount(reviewExpense)}</strong>
          </span>
          <span>
            <small>收入</small>
            <strong className="income">{formatAmount(reviewIncome)}</strong>
          </span>
          <span>
            <small>记录</small>
            <strong>{reviewCount} 笔</strong>
          </span>
        </div>

        {reviewMode === 'day' && (
          <div className="time-review-footer">
            <button
              type="button"
              className="time-review-add-btn"
              onClick={openCreateForReviewDay}
            >
              + 补记这天
            </button>
          </div>
        )}
      </section>

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
            在{reviewMode === 'month' ? reviewLabel : '全部记录'}中找到 {sortedRecords.length} 条
          </div>
        )}
      </div>

      <div className="list-actions">
        {reviewMode === 'all' && <span className="list-scope-label">全部记录</span>}
        <button
          className="review-all-btn"
          hidden={reviewMode === 'all'}
          onClick={() => selectReviewMode('all')}
        >
          查看全部
        </button>
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
          <strong>{isSearching ? '没有找到相关记录' : '这段时间还没有记录'}</strong>
          <span>{isSearching ? '换个日期、分类、标签或备注试试' : '可以切换时间，回看别的日子。'}</span>
        </div>
      ) : (
        <div className="records">
          {groupedRecords.map((item) =>
            item.type === 'header' ? showDateGroupHeaders && (
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
                      {getRecordSearchMeta(item) && (
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

      <SpendCalendar
        key={calendarSession}
        open={calendarOpen}
        records={records}
        selectedDate={reviewDate}
        view={calendarView}
        onViewChange={setCalendarView}
        onPick={pickCalendarDay}
        onClose={() => setCalendarOpen(false)}
      />

      <RecordEditor
        key={`create:${editorSession}`}
        open={creatingRecord}
        title="为这一天记一笔"
        dateNote={formatReviewLabel('day', reviewDate)}
        initial={{ type: 'expense', datetime: buildReviewDateTime(reviewDate) }}
        categories={categories}
        tags={tags}
        records={records}
        tagActions={tagActions}
        onSubmit={saveCreate}
        onClose={() => setCreatingRecord(false)}
      />

      <RecordEditor
        key={`edit:${editorSession}`}
        open={!!editingRecord}
        title="编辑记录"
        initial={editingRecord}
        submitLabel="保 存"
        categories={categories}
        tags={tags}
        records={records}
        tagActions={tagActions}
        onSubmit={saveEdit}
        onClose={() => setEditingRecord(null)}
      />

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
            {backupMonths.length > 0 && (
              <div className="backup-range" role="group" aria-label="备份范围">
                <button
                  type="button"
                  className={!selectedBackupMonth ? 'active' : ''}
                  aria-pressed={!selectedBackupMonth}
                  onClick={() => setBackupMonth('all')}
                >
                  全部
                  <small>{records.length} 笔</small>
                </button>
                {backupMonths.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={selectedBackupMonth?.key === item.key ? 'active' : ''}
                    aria-pressed={selectedBackupMonth?.key === item.key}
                    onClick={() => setBackupMonth(item.key)}
                  >
                    {formatBackupMonth(item)}
                    <small>{item.count} 笔</small>
                  </button>
                ))}
              </div>
            )}
            <button
              className="export-option-btn"
              onClick={handleExportBackup}
            >
              {selectedBackupMonth
                ? `导出 ${formatBackupMonth(selectedBackupMonth)}备份`
                : '导出备份'}
            </button>
            <button
              className="export-option-btn secondary"
              onClick={triggerImport}
            >
              导入备份
            </button>
          </div>

          <div className="data-manager-note">
            数据保存在本地。需要迁移或留存时，先导出备份，再在新设备导入。选某个月时只带走那个月的记录，分类和标签会一并带上；在新设备选「合并到当前数据」即可。
          </div>

          <div className="data-manager-divider" />

          {onOrganize && (
            <>
              <button
                type="button"
                className="export-option-btn secondary"
                onClick={() => {
                  closeDataManager();
                  onOrganize();
                }}
              >
                整理去向与细分
              </button>
              <div className="data-manager-divider" />
            </>
          )}

          <DataBookExport records={records} onExport={runExport} />

          {exportSuccess && (
            <div className="import-status success">{exportSuccess}</div>
          )}

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
              onClick={() => runExport('CSV ', () => exportCSV(records))}
            >
              导出 CSV
            </button>
            <button
              className="export-option-btn secondary"
              onClick={() => runExport('展示 JSON ', () => exportJSON(records))}
            >
              导出展示 JSON
            </button>
          </div>

          </>
          )}
        </div>
      </Modal>
    </div>
  );
}
