import { useEffect, useMemo, useRef, useState } from 'react';
import DonutChart from './DonutChart';
import CategorySheet from './CategorySheet';
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

function DonutCenter({ periodLabel, total, destinationCount, selected }) {
  const rollingTotal = useRollingNumber(total);

  if (selected) {
    return (
      <div className="stats-donut-center" key={`sel:${selected.name}`}>
        <span className="stats-donut-label">{selected.name}</span>
        <strong className={amountSizeClass(selected.amount)}>{money(selected.amount)}</strong>
        <span className="stats-donut-sub">占 {percent(selected.share)}</span>
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
    <ul className="stats-list">
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

export default function Statistics({ records }) {
  const [periodDays, setPeriodDays] = useState(1);
  // null | { kind: 'category', name, fromRest } | { kind: 'rest' }
  const [sheet, setSheet] = useState(null);

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
  const highlightedName = !sheet
    ? ''
    : sheet.kind === 'rest' || sheet.fromRest
      ? REST_NAME
      : sheet.name;
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

  const handleSelect = (name) => {
    const segment = segments.find((item) => item.name === name);
    if (!segment) return;
    setSheet(segment.isRest ? { kind: 'rest' } : { kind: 'category', name, fromRest: false });
  };

  const fixedSummary = vm.fixedExpenseSummary;

  return (
    <div className="statistics">
      <div className="stats-top">
        <PeriodSwitch value={periodDays} onChange={setPeriodDays} />
      </div>

      <section className="stats-overview" aria-label="钱去了哪里">
        <DonutChart
          segments={segments}
          selectedName={highlightedName}
          onSelect={handleSelect}
          label={segments.map((segment) => `${segment.name} ${percent(segment.share)}`).join('，') || '暂无支出'}
        >
          <DonutCenter
            periodLabel={vm.periodLabel}
            total={vm.currentTotal}
            destinationCount={destinationCount}
            selected={highlightedSegment}
          />
        </DonutChart>

        <p className="stats-summary" key={periodDays}>{vm.summarySentence}</p>
      </section>

      <DestinationList
        segments={segments}
        highlightedName={highlightedName}
        onSelect={handleSelect}
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
      />
    </div>
  );
}
