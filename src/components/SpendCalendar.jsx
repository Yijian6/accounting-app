import { useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import DonutChart from './DonutChart';
import { formatAmount } from '../utils/format';
import './SpendCalendar.css';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const VISIBLE_SEGMENTS = 5;

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function sameDay(left, right) {
  return dayKey(left) === dayKey(right);
}

/** 格子里放得下的金额：整数，千以上写成 1.2k */
function compactAmount(amount) {
  if (amount >= 10000) return `${Math.round(amount / 1000)}k`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (amount >= 10) return String(Math.round(amount));
  return amount.toFixed(1).replace(/\.0$/, '');
}

function percent(share) {
  return `${Math.round(share * 100)}%`;
}

/** 按当月最高的一天分五档深浅，只表达多少，不做评价 */
function levelOf(amount, max) {
  if (amount <= 0 || max <= 0) return 0;
  const ratio = amount / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.45) return 3;
  if (ratio > 0.2) return 2;
  return 1;
}

/** 这个月的去向构成：前 5 个单列，其余合成一块（和统计页一致） */
function buildSegments(byCategory, total) {
  if (total <= 0) return [];
  const sorted = [...byCategory.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((left, right) => right.amount - left.amount);
  const visible = sorted.slice(0, VISIBLE_SEGMENTS);
  const rest = sorted.slice(VISIBLE_SEGMENTS);
  const segments = visible.map((item, index) => ({
    ...item,
    share: item.amount / total,
    color: `var(--cat-${(index % 5) + 1})`,
  }));
  const restAmount = rest.reduce((sum, item) => sum + item.amount, 0);
  if (restAmount > 0) {
    const restName = visible.some((item) => item.name === '其他') ? '其余' : '其他';
    segments.push({
      name: restName,
      amount: restAmount,
      share: restAmount / total,
      color: 'var(--text-muted)',
      isRest: true,
      count: rest.length,
    });
  }
  return segments;
}

function buildMonth(records, monthStart, today) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totals = new Map();
  const byCategory = new Map();

  records.forEach((record) => {
    if (record.type !== 'expense') return;
    const date = new Date(record.datetime);
    if (Number.isNaN(date.getTime())) return;
    if (date.getFullYear() !== year || date.getMonth() !== month) return;
    const amount = Number(record.amount || 0);
    const key = date.getDate();
    totals.set(key, (totals.get(key) || 0) + amount);
    const name = record.category || '未分类';
    byCategory.set(name, (byCategory.get(name) || 0) + amount);
  });

  const max = Math.max(0, ...totals.values());
  const leading = (new Date(year, month, 1).getDay() + 6) % 7; // 周一开头
  const cells = Array.from({ length: leading }, (_, index) => ({ key: `pad-${index}`, pad: true }));

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day, 12);
    const amount = totals.get(day) || 0;
    cells.push({
      key: dayKey(date),
      date,
      day,
      amount,
      level: levelOf(amount, max),
      isToday: sameDay(date, today),
      isFuture: date > today && !sameDay(date, today),
    });
  }

  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return {
    cells,
    total,
    spentDays: totals.size,
    segments: buildSegments(byCategory, total),
    destinationCount: byCategory.size,
  };
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

/** 日历 / 圆环 两种看法的切换：一个滑块在两枚图标之间移动 */
function ViewSwitch({ view, onChange }) {
  return (
    <div className="spend-cal-views" role="group" aria-label="查看方式">
      <span
        className="spend-cal-views-thumb"
        aria-hidden="true"
        style={{ transform: `translate3d(${view === 'ring' ? 100 : 0}%, 0, 0)` }}
      />
      <button type="button" aria-pressed={view === 'grid'} aria-label="按天看" title="按天看" onClick={() => onChange('grid')}>
        <GridIcon />
      </button>
      <button type="button" aria-pressed={view === 'ring'} aria-label="按去向看" title="按去向看" onClick={() => onChange('ring')}>
        <RingIcon />
      </button>
    </div>
  );
}

function MonthRing({ month, monthNumber, focusName, onFocus }) {
  const focus = month.segments.find((segment) => segment.name === focusName) || null;

  return (
    <div className="spend-cal-ring">
      <DonutChart
        segments={month.segments}
        selectedName={focus ? focus.name : ''}
        onSelect={(name) => onFocus(name === focusName ? '' : name)}
        label={month.segments.map((segment) => `${segment.name} ${percent(segment.share)}`).join('，') || '这个月还没有支出'}
      >
        {focus ? (
          <div className="spend-cal-ring-center" key={`focus:${focus.name}`}>
            <span className="spend-cal-ring-label">
              <i style={{ background: focus.color }} aria-hidden="true" />
              {focus.name}
            </span>
            <strong className="is-percent">{percent(focus.share)}</strong>
            <span className="spend-cal-ring-sub">¥{formatAmount(focus.amount)}</span>
          </div>
        ) : (
          <div className="spend-cal-ring-center" key="total">
            <span className="spend-cal-ring-label">{monthNumber}月支出</span>
            <strong className={month.total >= 100000 ? 'is-long' : ''}>¥{formatAmount(month.total)}</strong>
            <span className="spend-cal-ring-sub">
              {month.destinationCount > 0 ? `${month.destinationCount} 个去向` : '还没有支出'}
            </span>
          </div>
        )}
      </DonutChart>

      {month.segments.length > 0 && (
        <ul className="spend-cal-rows">
          {month.segments.map((segment, index) => {
            const active = segment.name === focusName;
            return (
              <li key={segment.name} style={{ '--row': index }}>
                <button
                  type="button"
                  className={`spend-cal-row${active ? ' is-active' : ''}${focusName && !active ? ' is-dimmed' : ''}`}
                  aria-pressed={active}
                  onClick={() => onFocus(active ? '' : segment.name)}
                >
                  <i style={{ background: segment.color }} aria-hidden="true" />
                  <span className="spend-cal-row-name">
                    {segment.name}
                    {segment.isRest && <small> · {segment.count} 个</small>}
                  </span>
                  <span className="spend-cal-row-share">{percent(segment.share)}</span>
                  <span className="spend-cal-row-amount">¥{formatAmount(segment.amount)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function SpendCalendar({ open, records, selectedDate, view = 'grid', onViewChange, onPick, onClose }) {
  const today = useMemo(() => new Date(), []);
  const [monthStart, setMonthStart] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );
  const [slide, setSlide] = useState(0); // -1 往前，1 往后，用来决定内容从哪边进场
  const [focusName, setFocusName] = useState('');
  const touchXRef = useRef(null);

  const isCurrentMonth = monthStart.getFullYear() === today.getFullYear()
    && monthStart.getMonth() === today.getMonth();
  const month = useMemo(
    () => buildMonth(records, monthStart, today),
    [records, monthStart, today]
  );

  const shiftMonth = (direction) => {
    if (direction > 0 && isCurrentMonth) return;
    setSlide(direction);
    setFocusName('');
    setMonthStart((date) => new Date(date.getFullYear(), date.getMonth() + direction, 1));
  };

  const changeView = (next) => {
    if (next === view) return;
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
    shiftMonth(delta > 0 ? -1 : 1);
  };

  const monthLabel = `${monthStart.getFullYear()}年${monthStart.getMonth() + 1}月`;

  return (
    <Modal open={open} title="花销日历" onClose={onClose}>
      <div className="spend-cal">
        <div className="spend-cal-nav">
          <button type="button" className="spend-cal-arrow" onClick={() => shiftMonth(-1)} aria-label="上个月">‹</button>
          <div className="spend-cal-month">
            <strong>{monthLabel}</strong>
            <span>{month.spentDays > 0 ? `花了 ${formatAmount(month.total)} · ${month.spentDays} 天有支出` : '这个月还没有支出'}</span>
          </div>
          <button
            type="button"
            className="spend-cal-arrow"
            onClick={() => shiftMonth(1)}
            disabled={isCurrentMonth}
            aria-label="下个月"
          >
            ›
          </button>
        </div>

        <ViewSwitch view={view} onChange={changeView} />

        <div
          className={`spend-cal-stage slide-${slide}`}
          key={`${view}:${monthLabel}`}
          onTouchStart={(event) => { touchXRef.current = event.touches[0]?.clientX ?? null; }}
          onTouchEnd={handleTouchEnd}
        >
          {view === 'ring' ? (
            <MonthRing
              month={month}
              monthNumber={monthStart.getMonth() + 1}
              focusName={focusName}
              onFocus={setFocusName}
            />
          ) : (
            <>
              <div className="spend-cal-week" aria-hidden="true">
                {WEEKDAYS.map((name) => <span key={name}>{name}</span>)}
              </div>

              <div className="spend-cal-grid">
                {month.cells.map((cell, index) => (cell.pad ? (
                  <span key={cell.key} className="spend-cal-pad" />
                ) : (
                  <button
                    key={cell.key}
                    type="button"
                    className={[
                      'spend-cal-day',
                      `level-${cell.level}`,
                      cell.isToday ? 'is-today' : '',
                      sameDay(cell.date, selectedDate) ? 'is-selected' : '',
                    ].filter(Boolean).join(' ')}
                    style={{ '--cell-delay': `${Math.min(index, 34) * 9}ms` }}
                    disabled={cell.isFuture}
                    onClick={() => onPick(cell.date)}
                    aria-label={`${cell.date.getMonth() + 1}月${cell.day}日${cell.amount > 0 ? `，支出 ${formatAmount(cell.amount)}` : '，没有支出'}`}
                  >
                    <span className="spend-cal-num">{cell.isToday ? '今' : cell.day}</span>
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
  );
}
