import { useMemo, useState } from 'react';
import Modal from './Modal';
import DonutChart from './DonutChart';
import CategorySheet from './CategorySheet';
import { getStatisticsInsightViewModel } from '../utils/statistics';
import { exportDataBook } from '../utils/dataBookExport';
import { SAVE_RESULT } from '../utils/saveFile';
import { getChangeLabel, money, percent } from '../utils/statsText';
import './Statistics.css';

const PERIOD_OPTIONS = [
  { value: 7, label: '近7天' },
  { value: 30, label: '近30天' },
  { value: 1, label: '今日' },
];

const REST_NAME = '其他';
const REST_COLOR = 'var(--text-muted)';

const EXPORT_RANGE_OPTIONS = [
  { value: 'week', label: '周数据' },
  { value: 'month', label: '月数据' },
  { value: 'year', label: '年数据' },
  { value: 'all', label: '全部数据' },
];

const EXPORT_FORMAT_OPTIONS = [
  { value: 'html', label: 'HTML 数据册' },
  { value: 'xlsx', label: 'Excel 数据册' },
  { value: 'json', label: 'JSON 基础数据' },
];

function segmentColor(segment, index) {
  return segment.isRest ? REST_COLOR : `var(--cat-${(index % 5) + 1})`;
}

function PeriodSwitch({ value, onChange }) {
  const activeIndex = Math.max(0, PERIOD_OPTIONS.findIndex((option) => option.value === value));
  return (
    <div className="stats-period-switch" role="group" aria-label="统计周期">
      <span
        className="stats-period-thumb"
        aria-hidden="true"
        style={{ transform: `translate3d(${activeIndex * 100}%, 0, 0)` }}
      />
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`stats-period-option ${value === option.value ? 'active' : ''}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DonutCenter({ vm, selected }) {
  if (selected) {
    return (
      <div className="stats-donut-center" key={`sel:${selected.name}`}>
        <strong className={selected.amount >= 100000 ? 'is-long' : ''}>{money(selected.amount)}</strong>
        <span>{selected.name} · {percent(selected.share)}</span>
      </div>
    );
  }

  return (
    <div className="stats-donut-center" key="total">
      <strong className={vm.currentTotal >= 100000 ? 'is-long' : ''}>{money(vm.currentTotal)}</strong>
      <span className={`stats-donut-change ${vm.changeState}`}>
        {vm.hasRecords ? getChangeLabel(vm) : '还没有支出'}
      </span>
    </div>
  );
}

function CategoryDestination({ vm, segments, selectedName, onSelect }) {
  const selected = segments.find((segment) => segment.name === selectedName) || null;

  return (
    <section className="stats-section stats-destination">
      <div className="stats-section-head">
        <h3>钱去了哪里</h3>
        <p>
          {segments.length
            ? '点选圆环或下方去向，看看具体花在了什么上。'
            : '这段时间还没有可以分析的支出分类。'}
        </p>
      </div>

      <DonutChart
        segments={segments}
        selectedName={selectedName}
        onSelect={onSelect}
        label={segments.map((segment) => `${segment.name} ${percent(segment.share)}`).join('，') || '暂无支出'}
      >
        <DonutCenter vm={vm} selected={selected} />
      </DonutChart>

      {segments.length > 0 && (
        <ul className="stats-legend">
          {segments.map((segment) => (
            <li key={segment.name}>
              <button
                type="button"
                className={`stats-legend-row ${selectedName === segment.name ? 'active' : ''}`}
                aria-pressed={selectedName === segment.name}
                onClick={() => onSelect(segment.name)}
              >
                <span className="stats-legend-dot" style={{ background: segment.color }} aria-hidden="true" />
                <span className="stats-legend-name">{segment.name}</span>
                <span className="stats-legend-share">{percent(segment.share)}</span>
                <span className="stats-legend-amount">{money(segment.amount)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AttentionCard({ attention }) {
  return (
    <section className={`stats-attention-card ${attention.tone}`}>
      <h3>{attention.title}</h3>
      <p>{attention.body}</p>
    </section>
  );
}

export default function Statistics({ records }) {
  const [periodDays, setPeriodDays] = useState(7);
  // null | { kind: 'category', name, fromRest } | { kind: 'rest' }
  const [sheet, setSheet] = useState(null);
  const [showDataExport, setShowDataExport] = useState(false);
  const [exportRangeType, setExportRangeType] = useState('month');
  const [exportFormat, setExportFormat] = useState('html');
  const [exportError, setExportError] = useState('');

  const selectedCategory = sheet?.kind === 'category' ? sheet.name : '';
  const vm = useMemo(
    () => getStatisticsInsightViewModel(records, periodDays, selectedCategory),
    [records, periodDays, selectedCategory]
  );

  const segments = useMemo(
    () => vm.compositionSegments.map((segment, index) => ({
      ...segment,
      color: segmentColor(segment, index),
    })),
    [vm.compositionSegments]
  );

  const restSegment = segments.find((segment) => segment.isRest) || null;
  const highlightedName = !sheet
    ? ''
    : sheet.kind === 'rest' || sheet.fromRest
      ? REST_NAME
      : sheet.name;

  const sheetView = useMemo(() => {
    if (!sheet) return null;
    if (sheet.kind === 'rest') {
      return restSegment ? { kind: 'rest', segment: restSegment } : null;
    }
    const detail = vm.selectedCategoryDetail;
    if (!detail || detail.name !== sheet.name) return null;
    const segment = segments.find((item) => item.name === sheet.name);
    return {
      kind: 'category',
      detail,
      color: segment?.color || REST_COLOR,
      fromRest: !!sheet.fromRest,
    };
  }, [sheet, restSegment, vm.selectedCategoryDetail, segments]);

  const handleSelect = (name) => {
    const segment = segments.find((item) => item.name === name);
    if (!segment) return;
    setSheet(segment.isRest ? { kind: 'rest' } : { kind: 'category', name, fromRest: false });
  };

  const handleDataBookExport = async () => {
    setExportError('');
    try {
      const result = await exportDataBook(records, {
        rangeType: exportRangeType,
        format: exportFormat,
      });
      if (result !== SAVE_RESULT.CANCELLED) {
        setShowDataExport(false);
      }
    } catch {
      setExportError('这次没有导出成功，可以再试一次。');
    }
  };

  return (
    <div className="statistics">
      {/* ── 1. 周期 + 洞察 ── */}
      <div className="stats-hero">
        <div className="stats-hero-top">
          <PeriodSwitch value={periodDays} onChange={setPeriodDays} />
        </div>
        <div className="stats-insight" key={periodDays}>
          <h2 className="stats-headline">{vm.insightTitle}</h2>
          <p className="stats-sub">{vm.insightBody}</p>
        </div>
      </div>

      {/* ── 2. 钱去了哪里：环形图 + 图例 ── */}
      <CategoryDestination
        vm={vm}
        segments={segments}
        selectedName={highlightedName}
        onSelect={handleSelect}
      />

      {/* ── 3. 变化 ── */}
      {vm.hasRecords && <AttentionCard attention={vm.attention} />}

      <CategorySheet
        view={sheetView}
        onClose={() => setSheet(null)}
        onPickRestCategory={(name) => setSheet({ kind: 'category', name, fromRest: true })}
        onBackToRest={() => setSheet({ kind: 'rest' })}
        previousPeriodLabel={vm.previousPeriodLabel}
      />

      {/* ── 4. 底部：周期归属 + 导出 ── */}
      <div className="stats-footer">
        <section className="stats-fixed-card">
          <span>周期归属</span>
          <p>{vm.fixedExpenseSummary.description}</p>
          <p>{vm.fixedIncomeSummary.description}</p>
        </section>
        <button
          type="button"
          className="stats-export-link"
          onClick={() => { setExportError(''); setShowDataExport(true); }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          导出数据册
        </button>
      </div>

      <Modal
        open={showDataExport}
        title="导出数据册"
        onClose={() => setShowDataExport(false)}
      >
        <div className="data-book-export">
          <p>
            生成一份结构化数据册。HTML 更适合优雅查看，Excel 适合继续分析，JSON 适合保存基础数据。
          </p>

          <div className="export-field">
            <span>范围</span>
            <div className="export-choice-grid">
              {EXPORT_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={exportRangeType === option.value ? 'active' : ''}
                  onClick={() => setExportRangeType(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="export-field">
            <span>格式</span>
            <div className="export-choice-grid format">
              {EXPORT_FORMAT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={exportFormat === option.value ? 'active' : ''}
                  onClick={() => setExportFormat(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="data-book-note">
            HTML 数据册包含总览、分类去向、时间轨迹、记录明细和周期归属；只呈现数据，不做消费评价。
          </div>

          {exportError && (
            <div className="data-book-error">{exportError}</div>
          )}

          <button
            type="button"
            className="data-book-submit"
            onClick={handleDataBookExport}
          >
            导出
          </button>
        </div>
      </Modal>
    </div>
  );
}
