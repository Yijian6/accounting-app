import { useEffect, useRef, useState } from 'react';
import DataBookExport from './DataBookExport';
import { exportBackupJSON, exportCSV, exportJSON } from '../utils/export';
import { SAVE_RESULT } from '../utils/saveFile';
import { formatBackupSummary, getBackupMonths, parseBackupFileContent } from '../utils/backup';
import { track } from '../utils/telemetry';
import './DataManager.css';

function buildImportResultMessage(summary) {
  if (summary.mode === 'replace') {
    return `已覆盖为 ${summary.addedRecords} 条记录、${summary.addedCategories} 个去向、${summary.addedTags} 个细分。`;
  }

  return `已新增 ${summary.addedRecords} 条记录、${summary.addedCategories} 个去向、${summary.addedTags} 个细分；跳过 ${summary.skippedRecords} 条重复记录、${summary.skippedCategories} 个重复去向、${summary.skippedTags} 个重复细分。`;
}

/**
 * 数据管理：备份导出 / 导入、整理去向与细分、数据册、CSV / 展示 JSON。
 * 只有这一份实现，放在「设置」里；明细页的齿轮也打开同一处。
 */
export default function DataManager({ records, categories, tags, onImportBackup, onOrganize }) {
  const [pendingBackup, setPendingBackup] = useState(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [exportSuccess, setExportSuccess] = useState('');
  const [backupMonth, setBackupMonth] = useState('all');
  const [showMoreExport, setShowMoreExport] = useState(false);
  const fileInputRef = useRef(null);
  const exportSuccessTimerRef = useRef(null);

  useEffect(() => () => {
    if (exportSuccessTimerRef.current) clearTimeout(exportSuccessTimerRef.current);
  }, []);

  const showExportSuccess = (message) => {
    setExportSuccess(message);
    if (exportSuccessTimerRef.current) clearTimeout(exportSuccessTimerRef.current);
    exportSuccessTimerRef.current = setTimeout(() => {
      setExportSuccess('');
      exportSuccessTimerRef.current = null;
    }, 3000);
  };

  // task 必须同步发起保存（iOS 分享面板要求在点击的同步调用链里打开）
  const runExport = async (label, task, kind = 'databook') => {
    setImportError('');
    setImportSuccess('');
    setExportSuccess('');
    try {
      const result = await task();
      track('export', kind);
      if (result === SAVE_RESULT.SAVED) {
        showExportSuccess(`${label}已保存。`);
      } else if (result === SAVE_RESULT.DOWNLOADED) {
        showExportSuccess(`${label}已导出，请在下载中查收。`);
      }
    } catch {
      track('export_fail', kind);
      setImportError(`${label}这次没有导出成功，可以再试一次。`);
    }
  };

  const backupMonths = getBackupMonths(records);
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
      ), 'backup_month');
    }
    return runExport('备份', () => exportBackupJSON({ records, categories, tags }), 'backup');
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
      track('import_fail');
      setPendingBackup(null);
      setImportError(error instanceof Error ? error.message : '导入备份失败。');
    }
  };

  const runImport = (mode) => {
    if (!pendingBackup) return;

    const summary = onImportBackup(pendingBackup.payload, mode);
    track('import', mode);
    setImportSuccess(buildImportResultMessage(summary));
    setImportError('');
    setPendingBackup(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
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
        <button type="button" className="export-option-btn" onClick={handleExportBackup}>
          {selectedBackupMonth ? `导出 ${formatBackupMonth(selectedBackupMonth)}备份` : '导出备份'}
        </button>
        <button type="button" className="export-option-btn secondary" onClick={triggerImport}>
          导入备份
        </button>
      </div>

      <div className="data-manager-note">
        数据只保存在这台设备上。需要迁移或留存时，先导出备份，再在新设备导入。选某个月时只带走那个月的记录，去向和细分会一并带上；在新设备选「合并到当前数据」即可。
      </div>

      {exportSuccess && <div className="import-status success">{exportSuccess}</div>}
      {importError && <div className="import-status error">{importError}</div>}
      {importSuccess && <div className="import-status success">{importSuccess}</div>}

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
              <span>去向数</span>
              <strong>{pendingBackup.summary.categoryCount}</strong>
            </div>
            <div className="import-summary-item">
              <span>细分数</span>
              <strong>{pendingBackup.summary.tagCount}</strong>
            </div>
          </div>

          <div className="import-warning">
            <strong>覆盖模式会替换当前本地数据。</strong>
            <span>执行覆盖前，建议先导出一份当前备份。</span>
          </div>

          <div className="import-actions">
            <button type="button" className="export-option-btn secondary" onClick={() => runImport('merge')}>
              合并到当前数据
            </button>
            <button type="button" className="export-option-btn danger" onClick={() => runImport('replace')}>
              覆盖当前数据
            </button>
          </div>
        </div>
      )}

      <div className="data-manager-divider" />

      {onOrganize && (
        <>
          <button type="button" className="export-option-btn secondary" onClick={onOrganize}>
            整理去向与细分
          </button>
          <div className="data-manager-divider" />
        </>
      )}

      <DataBookExport records={records} onExport={runExport} />

      <button
        type="button"
        className={`more-toggle ${showMoreExport ? 'expanded' : ''}`}
        onClick={() => setShowMoreExport(!showMoreExport)}
      >
        {showMoreExport ? '收起' : '更多导出'}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {showMoreExport && (
        <div className="data-manager-section">
          <button
            type="button"
            className="export-option-btn secondary"
            onClick={() => runExport('CSV ', () => exportCSV(records), 'csv')}
          >
            导出 CSV
          </button>
          <button
            type="button"
            className="export-option-btn secondary"
            onClick={() => runExport('展示 JSON ', () => exportJSON(records), 'json')}
          >
            导出展示 JSON
          </button>
        </div>
      )}
    </div>
  );
}
