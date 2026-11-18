import { useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import DonutChart from './DonutChart';
import CategorySheet from './CategorySheet';
import { formatAmount } from '../utils/format';
import { buildPeriodView, monthRange, yearRange } from '../utils/periodView';
import { track } from '../utils/telemetry';
import './SpendCalendar.css';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function sameDay(left, right) {
  return dayKey(left) === dayKey(right);
}

/** 格子里放得下的金额：整数，千以上写成 1.2k，万以上写成 1.2w */
function compactAmount(amount) {
  if (amount >= 100000) return `${Math.round(amount / 10000)}w`;
  if (amount >= 10000) return `${(amount / 10000).toFixed(1).replace(/\.0$/, '')}w`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (amount >= 10) return String(Math.round(amount));
  return amount.toFixed(1).replace(/\.0$/, '');
}

function percent(share) {
  return `${Math.round(share * 100)}%`;
}

/** 按这段时间里最高的一格分五档深浅，只表达多少，不做评价 */
function levelOf(amount, max) {
  if (amount <= 0 || max <= 0) return 0;
  const ratio = amount / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.45) return 3;
  if (ratio > 0.2) return 2;
  return 1;
}

function expenseTotalsBy(records, keyOf, range) {
  const totals = new Map();
  records.forEach((record) => {
    if (record.type !== 'expense') return;
    const date = new Date(record.datetime);
    if (Number.isNaN(date.getTime()) || date < range.start || date >= range.endExclusive) return;
    const key = keyOf(date);
    totals.set(key, (totals.get(key) || 0) + Number(record.amount || 0));
  });
  return totals;
}

function buildMonthCells(records, anchor, today) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const totals = expenseTotalsBy(records, (date) => date.getDate(), monthRange(anchor));
  const max = Math.max(0, ...totals.values());
  const leading = (new Date(year, month, 1).getDay() + 6) % 7; // 周一开头
  const cells = Array.from({ length: leading }, (_, index) => ({ key: `pad-${index}`, pad: true }));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day, 12);
    const amount = totals.get(day) || 0;
    cells.push({
      key: dayKey(date),
      date,
      label: sameDay(date, today) ? '今' : String(day),
      ariaLabel: `${month + 1}月${day}日`,
      amount,
      level: levelOf(amount, max),
      isNow: sameDay(date, today),
      isFuture: date > today && !sameDay(date, today),
    });
  }
  return { cells, activeCount: totals.size };
}

function buildYearCells(records, anchor, today) {
  const year = anchor.getFullYear();
  const totals = expenseTotalsBy(records, (date) => date.getMonth(), yearRange(anchor));
  const max = Math.max(0, ...totals.values());
  const cells = Array.from({ length: 12 }, (_, month) => {
    const date = new Date(year, month, 1, 12);
    const amount = totals.get(month) || 0;
    const isNow = year === today.getFullYear() && month === today.getMonth();
    return {
      key: `${year}-${month}`,
      date,
      label: `${month + 1}月`,
      ariaLabel: `${month + 1}月`,
      amount,
      level: levelOf(amount, max),
      isNow,
      isFuture: year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth()),
    };
  });
  return { cells, activeCount: totals.size };
}

function GridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="16" rx="3" />
      <path d="M3.5 9.5h17M9.2 9.5v11M14.8 9.5v11M3.5 15h17" />
    </svg>
  );
}

function RingIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 3.5a8.5 8.5 0 1 1-8.1 5.9" />
      <path d="M12 3.5a8.5 8.5 0 0 0-8.1 5.9" opacity="0.4" />
    </svg>
  );
}

/** 两种看法的切换：一个滑块在两枚图标之间移动 */
function ViewSwitch({ view, gridLabel, onChange }) {
  return (
    <div className="spend-cal-views" role="group" aria-label="查看方式">
      <span
        className="spend-cal-views-thumb"
        aria-hidden="true"
        style={{ transform: `translate3d(${view === 'ring' ? 100 : 0}%, 0, 0)` }}
      />
      <button type="button" aria-pressed={view === 'grid'} aria-label={gridLabel} title={gridLabel} onClick={() => onChange('grid')}>
        <GridIcon />
      </button>
      <button type="button" aria-pressed={view === 'ring'} aria-label="按去向看" title="按去向看" onClick={() => onChange('ring')}>
        <RingIcon />
      </button>
    </div>
  );
}

function PeriodRing({ period, periodName, focusName, onFocus, onOpen }) {
  const focus = period.segments.find((segment) => segment.name === focusName) || null;

  return (
    <div className="spend-cal-ring">
      <DonutChart
        segments={period.segments}
        selectedName={focus ? focus.name : ''}
        onSelect={(name) => onFocus(name === focusName ? '' : name)}
        onCenterClick={() => { if (focus) onOpen(focus.name); }}
        label={period.segments.map((segment) => `${segment.name} ${percent(segment.share)}`).join('，') || '还没有支出'}
      >
        {focus ? (
          <div className="spend-cal-ring-center" key={`focus:${focus.name}`}>
            <span className="spend-cal-ring-label">
              <i style={{ background: focus.color }} aria-hidden="true" />
              {focus.name}
            </span>
            <strong className="is-percent">{percent(focus.share)}</strong>
            <span className="spend-cal-ring-sub">
              ¥{formatAmount(focus.amount)}
              <em aria-hidden="true"> ›</em>
            </span>
          </div>
        ) : (
          <div className="spend-cal-ring-center" key="total">
            <span className="spend-cal-ring-label">{periodName}支出</span>
            <strong className={period.total >= 100000 ? 'is-long' : ''}>¥{formatAmount(period.total)}</strong>
            <span className="spend-cal-ring-sub">
              {period.destinationCount > 0 ? `${period.destinationCount} 个去向` : '还没有支出'}
            </span>
          </div>
        )}
      </DonutChart>

      {period.segments.length > 0 && (
        <ul className="spend-cal-rows">
          {period.segments.map((segment, index) => {
            const active = segment.name === focusName;
            return (
              <li key={segment.name} style={{ '--row': index }}>
                <button
                  type="button"
                  className={`spend-cal-row${active ? ' is-active' : ''}${focusName && !active ? ' is-dimmed' : ''}`}
                  onClick={() => onOpen(segment.name)}
                  aria-label={`${segment.name}，${percent(segment.share)}，查看明细`}
                >
                  <i style={{ background: segment.color }} aria-hidden="true" />
                  <span className="spend-cal-row-name">
                    {segment.name}
                    {segment.isRest && <small> · {segment.categories.length} 个</small>}
                  </span>
                  <span className="spend-cal-row-share">{percent(segment.share)}</span>
                  <span className="spend-cal-row-amount">¥{formatAmount(segment.amount)}</span>
                  <svg className="spend-cal-row-go" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * 花销日历。scope = 'month'：一个月的日历；scope = 'year'：一年 12 个月。
 * 两种都能切到「按去向看」的圆环，点去向打开和统计页同一个详情浮层（这段时间、按付款日计）。
 */
export default function SpendCalendar({
  open,
  records,
  selectedDate,
  scope = 'month',
  view = 'grid',
  onViewChange,
  onPickDay,
  onPickMonth,
  onEditRecord,
  onClose,
}) {
  const isYear = scope === 'year';
  const today = useMemo(() => new Date(), []);
  const [anchor, setAnchor] = useState(() => (
    isYear
      ? new Date(selectedDate.getFullYear(), 0, 1)
      : new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  ));
  const [slide, setSlide] = useState(0); // -1 往前，1 往后，用来决定内容从哪边进场
  const [focusName, setFocusName] = useState('');
  // 详情：null | { kind: 'category', name, fromRest } | { kind: 'rest' }
  const [sheet, setSheet] = useState(null);
  const touchXRef = useRef(null);

  const isCurrent = isYear
    ? anchor.getFullYear() >= today.getFullYear()
    : anchor.getFullYear() === today.getFullYear() && anchor.getMonth() === today.getMonth();

  const grid = useMemo(
    () => (isYear ? buildYearCells(records, anchor, today) : buildMonthCells(records, anchor, today)),
    [isYear, records, anchor, today]
  );
  const period = useMemo(
    () => buildPeriodView(records, isYear ? yearRange(anchor) : monthRange(anchor), isYear ? '本年' : '本月'),
    [isYear, records, anchor]
  );

  const shift = (direction) => {
    if (direction > 0 && isCurrent) return;
    setSlide(direction);
    setFocusName('');
    setSheet(null);
    setAnchor((date) => (
      isYear
        ? new Date(date.getFullYear() + direction, 0, 1)
        : new Date(date.getFullYear(), date.getMonth() + direction, 1)
    ));
  };

  const changeView = (next) => {
    if (next === view) return;
    track('calendar_view', next);
    setSlide(0);
    setFocusName('');
    onViewChange?.(next);
  };

  const handleTouchEnd = (event) => {
    const startX = touchXRef.current;
    touchXRef.current = null;
    if (startX == null) return;
    const delta = (event.changedTouches[0]?.clientX ?? startX) - startX;
    if (Math.abs(delta) < 48) return;
    shift(delta > 0 ? -1 : 1);
  };

  const openDetail = (name) => {
    const segment = period.segments.find((item) => item.name === name);
    if (!segment) return;
    track('calendar_detail');
    setFocusName(name);
    setSheet(segment.isRest ? { kind: 'rest' } : { kind: 'category', name, fromRest: false });
  };

  const restSegment = period.segments.find((item) => item.isRest) || null;
  const sheetView = useMemo(() => {
    if (!sheet) return null;
    if (sheet.kind === 'rest') return restSegment ? { kind: 'rest', segment: restSegment } : null;
    const detail = period.detailFor(sheet.name);
    if (!detail) return null;
    const segment = period.segments.find((item) => item.name === sheet.name);
    return {
      kind: 'category',
      detail,
      color: segment?.color || 'var(--text-muted)',
      fromRest: !!sheet.fromRest,
    };
  }, [sheet, period, restSegment]);

  const label = isYear ? `${anchor.getFullYear()}年` : `${anchor.getFullYear()}年${anchor.getMonth() + 1}月`;
  const periodName = isYear ? `${anchor.getFullYear()}年` : `${anchor.getMonth() + 1}月`;
  const summary = period.total > 0
    ? `花了 ${formatAmount(period.total)} · ${grid.activeCount} ${isYear ? '个月' : '天'}有支出`
    : `这${isYear ? '一年' : '个月'}还没有支出`;

  const closeAll = () => {
    setSheet(null);
    onClose();
  };

  return (
    <>
      <Modal open={open} title="花销日历" onClose={closeAll}>
        <div className="spend-cal">
          <div className="spend-cal-nav">
            <button type="button" className="spend-cal-arrow" onClick={() => shift(-1)} aria-label={isYear ? '上一年' : '上个月'}>‹</button>
            <div className="spend-cal-month">
              <strong>{label}</strong>
              <span>{summary}</span>
            </div>
            <button
              type="button"
              className="spend-cal-arrow"
              onClick={() => shift(1)}
              disabled={isCurrent}
              aria-label={isYear ? '下一年' : '下个月'}
            >
              ›
            </button>
          </div>

          <ViewSwitch view={view} gridLabel={isYear ? '按月看' : '按天看'} onChange={changeView} />

          <div
            className={`spend-cal-stage slide-${slide}`}
            key={`${scope}:${view}:${label}`}
            onTouchStart={(event) => { touchXRef.current = event.touches[0]?.clientX ?? null; }}
            onTouchEnd={handleTouchEnd}
          >
            {view === 'ring' ? (
              <PeriodRing
                period={period}
                periodName={periodName}
                focusName={focusName}
                onFocus={setFocusName}
                onOpen={openDetail}
              />
            ) : (
              <>
                {!isYear && (
                  <div className="spend-cal-week" aria-hidden="true">
                    {WEEKDAYS.map((name) => <span key={name}>{name}</span>)}
                  </div>
                )}

                <div className={`spend-cal-grid${isYear ? ' is-year' : ''}`}>
                  {grid.cells.map((cell, index) => (cell.pad ? (
                    <span key={cell.key} className="spend-cal-pad" />
                  ) : (
                    <button
                      key={cell.key}
                      type="button"
                      className={[
                        'spend-cal-day',
                        `level-${cell.level}`,
                        cell.isNow ? 'is-today' : '',
                        !isYear && sameDay(cell.date, selectedDate) ? 'is-selected' : '',
                      ].filter(Boolean).join(' ')}
                      style={{ '--cell-delay': `${Math.min(index, 34) * (isYear ? 22 : 9)}ms` }}
                      disabled={cell.isFuture}
                      onClick={() => (isYear ? onPickMonth?.(cell.date) : onPickDay?.(cell.date))}
                      aria-label={`${cell.ariaLabel}${cell.amount > 0 ? `，支出 ${formatAmount(cell.amount)}` : '，没有支出'}`}
                    >
                      <span className="spend-cal-num">{cell.label}</span>
                      <span className="spend-cal-amt">{cell.amount > 0 ? compactAmount(cell.amount) : ''}</span>
                    </button>
                  )))}
                </div>

                <div className="spend-cal-legend" aria-hidden="true">
                  <span>少</span>
                  {[1, 2, 3, 4].map((level) => <i key={level} className={`level-${level}`} />)}
                  <span>多</span>
                </div>
              </>
            )}
          </div>
        </div>
      </Modal>

      <CategorySheet
        view={open ? sheetView : null}
        onClose={() => setSheet(null)}
        onPickRestCategory={(name) => setSheet({ kind: 'category', name, fromRest: true })}
        onBackToRest={() => setSheet({ kind: 'rest' })}
        previousPeriodLabel=""
        periodNoun={isYear ? '本年' : '本月'}
        onEditRecord={onEditRecord}
      />
    </>
  );
}
