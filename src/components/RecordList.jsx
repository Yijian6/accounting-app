import { useRef, useState } from 'react';
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
  const fileInputRef = useRef(null);

  const todayExpense = records
    .filter((record) => record.type === 'expense' && isToday(record.datetime))
    .reduce((sum, record) => sum + record.amount, 0);
  const monthExpense = records
    .filter((record) => record.type === 'expense' && isThisMonth(record.datetime))
    .reduce((sum, record) => sum + record.amount, 0);

  const sortedRecords = [...records].sort(
    (left, right) => new Date(right.datetime) - new Date(left.datetime)
  );

  const groupedRecords = [];
  let currentKey = '';
  for (const record of sortedRecords) {
    const key = getDateKey(record.datetime);
    if (key !== currentKey) {
      currentKey = key;
      groupedRecords.push({ type: 'header', label: getDateGroup(record.datetime), key });
    }
    groupedRecords.push({ type: 'record', ...record });
  }

  const startEdit = (record) => {
    setEditingRecord(record);
    setEditForm({
      amount: record.amount.toString(),
      type: record.type,
      category: record.category,
      tags: [...record.tags],
      note: record.note || '',
      datetime: toDatetimeLocal(record.datetime),
    });
    setShowMoreEdit(false);
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
        <div className="summary-card">
          <span className="summary-label">今日支出</span>
          <span className="summary-value expense">{formatAmount(todayExpense)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">本月支出</span>
          <span className="summary-value expense">{formatAmount(monthExpense)}</span>
        </div>
      </div>

      <div className="list-actions">
        <span className="list-count">{records.length} 条记录</span>
        <button className="manage-icon-btn-inline" onClick={openDataManager} title="数据管理">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {sortedRecords.length === 0 ? (
        <div className="empty-state">暂无记录</div>
      ) : (
        <div className="records">
          {groupedRecords.map((item) =>
            item.type === 'header' ? (
              <div key={item.key} className="date-group-header">
                <span>{item.label}</span>
              </div>
            ) : (
              <button
                key={item.id}
                className="record-item"
                onClick={() => startEdit(item)}
              >
                <span className="record-category">{item.category}</span>
                <span className={`record-amount ${item.type}`}>
                  {item.type === 'expense' ? '-' : '+'}{formatAmount(item.amount)}
                </span>
              </button>
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
            <p className="export-desc">当前本地有 {records.length} 条记录，建议定期导出备份。</p>
            <button
              className="export-option-btn"
              onClick={() => exportBackupJSON({ records, categories, tags })}
            >
              导出备份
            </button>
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
        </div>
      </Modal>
    </div>
  );
}
