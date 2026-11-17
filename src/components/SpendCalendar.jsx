import { useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import { formatAmount } from '../utils/format';
import './SpendCalendar.css';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

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

/** 按当月最高的一天分五档深浅，只表达多少，不做评价 */
function levelOf(amount, max) {
  if (amount <= 0 || max <= 0) return 0;
  const ratio = amount / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.45) return 3;
  if (ratio > 0.2) return 2;
  return 1;
}

function buildMonth(records, monthStart, today) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totals = new Map();

  records.forEach((record) => {
    if (record.type !== 'expense') return;
    const date = new Date(record.datetime);
    if (Number.isNaN(date.getTime())) return;
    if (date.getFullYear() !== year || date.getMonth() !== month) return;
    const key = date.getDate();
    totals.set(key, (totals.get(key) || 0) + Number(record.amount || 0));
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
  return { cells, total, spentDays: totals.size };
}

export default function SpendCalendar({ open, records, selectedDate, onPick, onClose }) {
  const today = useMemo(() => new Date(), []);
  const [monthStart, setMonthStart] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );
  const [slide, setSlide] = useState(0); // -1 往前，1 往后，用来决定格子从哪边进场
  const touchXRef = useRef(null);

  const isCurrentMonth = monthStart.getFullYear() === today.getFullYear()
    && monthStart.getMonth() === today.getMonth();
  const { cells, total, spentDays } = useMemo(
    () => buildMonth(records, monthStart, today),
    [records, monthStart, today]
  );

  const shiftMonth = (direction) => {
    if (direction > 0 && isCurrentMonth) return;
    setSlide(direction);
    setMonthStart((date) => new Date(date.getFullYear(), date.getMonth() + direction, 1));
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
            <span>{spentDays > 0 ? `花了 ${formatAmount(total)} · ${spentDays} 天有支出` : '这个月还没有支出'}</span>
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

        <div className="spend-cal-week" aria-hidden="true">
          {WEEKDAYS.map((name) => <span key={name}>{name}</span>)}
        </div>

        <div
          className={`spend-cal-grid slide-${slide}`}
          key={monthLabel}
          onTouchStart={(event) => { touchXRef.current = event.touches[0]?.clientX ?? null; }}
          onTouchEnd={handleTouchEnd}
        >
          {cells.map((cell, index) => (cell.pad ? (
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
      </div>
    </Modal>
  );
}
