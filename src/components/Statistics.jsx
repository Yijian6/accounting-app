import { useEffect, useMemo, useRef, useState } from 'react';
import DonutChart from './DonutChart';
import CategorySheet from './CategorySheet';
import RecordEditor from './RecordEditor';
import { getStatisticsInsightViewModel } from '../utils/statistics';
import { money, percent } from '../utils/statsText';
import './Statistics.css';

const PERIOD_OPTIONS = [
  { value: 1, label: '今日' },
  { value: 7, label: '7 天' },
  { value: 30, label: '30 天' },
];

const REST_NAME = '其他';
const REST_COLOR = 'var(--text-muted)';
const ROLL_MS = 600;

function segmentColor(segment, index) {
  return segment.isRest ? REST_COLOR : `var(--cat-${(index % 5) + 1})`;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** 数值变化时从旧值滚到新值；首次渲染和减弱动态效果时直接显示终值 */
function useRollingNumber(target) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return undefined;

    const instant = prefersReducedMotion();
    const startedAt = performance.now();
    const tick = (now) => {
      const progress = instant ? 1 : Math.min(1, (now - startedAt) / ROLL_MS);
      const eased = 1 - (1 - progress) ** 3;
      const value = from + (target - from) * eased;
      fromRef.current = value;
      setDisplay(value);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target]);

  return display;
}

function amountSizeClass(amount) {
  if (amount >= 1000000) return 'is-longer';
  if (amount >= 10000) return 'is-long';
  return '';
}

function PeriodSwitch({ value, onChange }) {
  const activeIndex = Math.max(0, PERIOD_OPTIONS.findIndex((option) => option.value === value));
  return (
    <div className="stats-period-switch" role="group" aria-label="统计周期" data-guide="period">
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

function DonutCenter({ periodLabel, total, destinationCount, selected, canOpen }) {
  const rollingTotal = useRollingNumber(total);

  // 选中一块：中心只讲它占多少
  if (selected) {
    return (
      <div className="stats-donut-center is-focus" key={`sel:${selected.name}`}>
        <span className="stats-donut-label">
          <i style={{ background: selected.color }} aria-hidden="true" />
          {selected.name}
        </span>
        <strong className="stats-donut-percent">{percent(selected.share)}</strong>
        <span className="stats-donut-sub">
          {money(selected.amount)}
          {canOpen && <em aria-hidden="true"> ›</em>}
        </span>
      </div>
    );
  }

  return (
    <div className="stats-donut-center" key="total">
      <span className="stats-donut-label">{periodLabel}支出</span>
      <strong className={amountSizeClass(total)}>{money(rollingTotal)}</strong>
      {destinationCount > 0 && (
        <span className="stats-donut-sub">{destinationCount} 个去向</span>
      )}
    </div>
  );
}

function DestinationList({ segments, highlightedName, onSelect }) {
  if (!segments.length) return null;
  return (
    <ul className="stats-list" data-guide="stats-list">
      {segments.map((segment) => {
        const active = highlightedName === segment.name;
        return (
          <li key={segment.name}>
            <button
              type="button"
              className={`stats-row${active ? ' active' : ''}${highlightedName && !active ? ' dimmed' : ''}`}
              onClick={() => onSelect(segment.name)}
            >
              <span className="stats-row-dot" style={{ background: segment.color }} aria-hidden="true" />
              <span className="stats-row-name">{segment.name}</span>
              <span className="stats-row-share">{percent(segment.share)}</span>
              <span className="stats-row-amount">{money(segment.amount)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function Statistics({ records, categories = [], tags = [], tagActions, onUpdate }) {
  const [periodDays, setPeriodDays] = useState(1);
  const changePeriod = (days) => {
    setPeriodDays(days);
    setFocusName('');
  };
  // 从分类详情里点开的那一笔（原始记录，不是分摊后的副本）
  const [editingId, setEditingId] = useState('');
  const [editorSession, setEditorSession] = useState(0);
  const editingRecord = editingId ? records.find((record) => record.id === editingId) || null : null;
  // null | { kind: 'category', name, fromRest } | { kind: 'rest' }
  const [sheet, setSheet] = useState(null);
  // 圆环上点选的那一块：只改变圆环和中心，不弹详情
  const [focusName, setFocusName] = useState('');

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

  const destinationCount = segments.reduce(
    (count, segment) => count + (segment.isRest ? segment.categories?.length || 1 : 1),
    0
  );

  const restSegment = segments.find((segment) => segment.isRest) || null;
  const sheetName = !sheet
    ? ''
    : sheet.kind === 'rest' || sheet.fromRest
      ? REST_NAME
      : sheet.name;
  const focusSegment = segments.find((segment) => segment.name === focusName) || null;
  const highlightedName = sheetName || (focusSegment ? focusName : '');
  const highlightedSegment = segments.find((segment) => segment.name === highlightedName) || null;

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

  const openSheet = (name) => {
    const segment = segments.find((item) => item.name === name);
    if (!segment) return;
    setSheet(segment.isRest ? { kind: 'rest' } : { kind: 'category', name, fromRest: false });
  };

  // 圆环：点一块只聚焦，再点同一块取消；聚焦时点中心才看详情
  const handleDonutSelect = (name) => {
    setFocusName((current) => (current === name ? '' : name));
  };

  const handleDonutCenter = () => {
    if (focusSegment) openSheet(focusSegment.name);
  };

  // 列表行：直接看详情，并让圆环停在这一块
  const handleRowSelect = (name) => {
    setFocusName(name);
    openSheet(name);
  };

  const fixedSummary = vm.fixedExpenseSummary;

  return (
    <div className="statistics">
      <div className="stats-top">
        <PeriodSwitch value={periodDays} onChange={changePeriod} />
      </div>

      <section className="stats-overview" aria-label="钱去了哪里">
        <DonutChart
          guide="donut"
          segments={segments}
          selectedName={highlightedName}
          onSelect={handleDonutSelect}
          onCenterClick={handleDonutCenter}
          label={segments.map((segment) => `${segment.name} ${percent(segment.share)}`).join('，') || '暂无支出'}
        >
          <DonutCenter
            periodLabel={vm.periodLabel}
            total={vm.currentTotal}
            destinationCount={destinationCount}
            selected={highlightedSegment}
            canOpen={!sheet && !!focusSegment}
          />
        </DonutChart>

        <p className="stats-summary" key={periodDays} data-guide="summary">{vm.summarySentence}</p>
      </section>

      <DestinationList
        segments={segments}
        highlightedName={highlightedName}
        onSelect={handleRowSelect}
      />

      {fixedSummary.count > 0 && fixedSummary.total > 0 && (
        <p className="stats-footnote">含周期支出分摊 {money(fixedSummary.total)}</p>
      )}

      <CategorySheet
        view={sheetView}
        onClose={() => setSheet(null)}
        onPickRestCategory={(name) => setSheet({ kind: 'category', name, fromRest: true })}
        onBackToRest={() => setSheet({ kind: 'rest' })}
        previousPeriodLabel={vm.previousPeriodLabel}
        onEditRecord={onUpdate ? (id) => {
          setEditorSession((value) => value + 1);
          setEditingId(id);
        } : undefined}
      />

      {onUpdate && (
        <RecordEditor
          key={editorSession}
          open={!!editingRecord}
          title="编辑记录"
          initial={editingRecord}
          submitLabel="保 存"
          categories={categories}
          tags={tags}
          records={records}
          tagActions={tagActions}
          onSubmit={(data) => {
            onUpdate(editingId, data);
            setEditingId('');
          }}
          onClose={() => setEditingId('')}
        />
      )}
    </div>
  );
}
