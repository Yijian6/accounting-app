import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { Sheet } from './Modal';
import {
  formatDayHeading,
  getChangeLabel,
  getDayKey,
  getRecordDisplayAmount,
  getRecordSubtitle,
  getRecordTitle,
  money,
  percent,
  recordMatches,
} from '../utils/statsText';
import { tagBreakdown } from '../utils/periodView';
import { track } from '../utils/telemetry';
import './CategorySheet.css';

const BREAKDOWN_SHOWN = 4;

/** 一行文字说清这个去向里钱又分到了哪些细分：午餐 ¥310 · 晚餐 ¥120 · 不分细分 ¥40 */
function TagLine({ records }) {
  const buckets = tagBreakdown(records, getRecordDisplayAmount);
  if (buckets.length === 0) return null;
  const shown = buckets.slice(0, BREAKDOWN_SHOWN);
  const restAmount = buckets.slice(BREAKDOWN_SHOWN).reduce((sum, item) => sum + item.amount, 0);
  return (
    <p className="csheet-tagline">
      {shown.map((item, index) => (
        <span key={item.name} className={item.untagged ? 'is-untagged' : ''}>
          {index > 0 && <i aria-hidden="true"> · </i>}
          {item.name} <b>{money(item.amount)}</b>
        </span>
      ))}
      {restAmount > 0 && (
        <span><i aria-hidden="true"> · </i>其余 <b>{money(restAmount)}</b></span>
      )}
    </p>
  );
}

const TOP_COUNT = 5;

function CloseButton({ onClick }) {
  return (
    <button type="button" className="csheet-icon-btn" onClick={onClick} aria-label="关闭">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}

function BackButton({ onClick }) {
  return (
    <button type="button" className="csheet-icon-btn" onClick={onClick} aria-label="返回其他分类">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}

function RecordRow({ record, withDate = true, onEdit }) {
  const subtitle = getRecordSubtitle(record, { withDate });
  const content = (
    <>
      <span className="csheet-record-text">
        <strong>{getRecordTitle(record)}</strong>
        {subtitle && <small>{subtitle}</small>}
      </span>
      <b>{money(getRecordDisplayAmount(record))}</b>
    </>
  );

  if (!onEdit) {
    return <li className="csheet-record">{content}</li>;
  }

  // 点一笔直接打开它的编辑浮层
  return (
    <li>
      <button
        type="button"
        className="csheet-record csheet-record--link csheet-record--edit"
        onClick={() => onEdit(record.id)}
        aria-label={`编辑：${getRecordTitle(record)} ${money(getRecordDisplayAmount(record))}`}
      >
        {content}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>
    </li>
  );
}

function SheetHeader({ name, color, amount, meta, onClose, onBack, children }) {
  return (
    <div className="csheet-header" data-sheet-grab>
      <div className="csheet-title-row">
        {onBack && <BackButton onClick={onBack} />}
        <h2 className="csheet-title">
          <span className="csheet-dot" style={{ background: color }} aria-hidden="true" />
          {name}
        </h2>
        <CloseButton onClick={onClose} />
      </div>
      <div className="csheet-amount">{money(amount)}</div>
      <p className="csheet-meta">{meta}</p>
      {children}
    </div>
  );
}

function AllRecords({ records, onEdit }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('time');
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(
    () => records.filter((record) => recordMatches(record, deferredQuery)),
    [records, deferredQuery]
  );

  const groups = useMemo(() => {
    if (sort === 'amount') return null;
    const map = new Map();
    filtered.forEach((record) => {
      const key = getDayKey(record.datetime);
      if (!map.has(key)) map.set(key, { key, heading: formatDayHeading(record.datetime), total: 0, items: [] });
      const group = map.get(key);
      group.items.push(record);
      group.total += getRecordDisplayAmount(record);
    });
    return [...map.values()];
  }, [filtered, sort]);

  const byAmount = useMemo(
    () => (sort === 'amount'
      ? [...filtered].sort((a, b) => getRecordDisplayAmount(b) - getRecordDisplayAmount(a))
      : null),
    [filtered, sort]
  );

  return (
    <div className="csheet-all">
      <div className="csheet-tools">
        <label className="csheet-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="20" y1="20" x2="16.2" y2="16.2" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="细分、备注、金额"
            aria-label="搜索这个分类的记录"
            enterKeyHint="search"
          />
        </label>
        <div className="csheet-sort" role="group" aria-label="排序方式" data-active={sort}>
          <span className="csheet-sort-thumb" aria-hidden="true" />
          <button type="button" aria-pressed={sort === 'time'} onClick={() => setSort('time')}>时间</button>
          <button type="button" aria-pressed={sort === 'amount'} onClick={() => setSort('amount')}>金额</button>
        </div>
      </div>

      <div className="csheet-scroll" data-sheet-scroll>
        {filtered.length === 0 ? (
          <p className="csheet-empty">没有找到「{deferredQuery.trim()}」相关的记录。</p>
        ) : byAmount ? (
          <ul className="csheet-records">
            {byAmount.map((record) => <RecordRow key={record.id} record={record} onEdit={onEdit} />)}
          </ul>
        ) : (
          groups.map((group) => (
            <section key={group.key} className="csheet-day">
              <h3 className="csheet-day-head">
                <span>{group.heading}</span>
                <span>{money(group.total)}</span>
              </h3>
              <ul className="csheet-records">
                {group.items.map((record) => <RecordRow key={record.id} record={record} withDate={false} onEdit={onEdit} />)}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function CategoryBody({ detail, color, detent, onExpand, onClose, onBack, previousPeriodLabel, peekRef, onEdit }) {
  const records = useMemo(() => detail.records || [], [detail.records]);
  const top = useMemo(
    () => [...records]
      .sort((a, b) => getRecordDisplayAmount(b) - getRecordDisplayAmount(a))
      .slice(0, TOP_COUNT),
    [records]
  );
  // 日历里的月 / 年详情自带 meta（不和上一期比），统计页用原来的「占本期 · 日均 · 较上期」
  let meta = detail.meta;
  if (!meta) {
    const change = getChangeLabel(detail);
    const changeText = detail.changeState === 'up' || detail.changeState === 'down'
      ? `较${previousPeriodLabel} ${change}`
      : change;
    meta = `占本期 ${percent(detail.share)} · 日均 ${money(detail.dailyAverage)} · ${changeText}`;
  }

  return (
    <div className="csheet-body">
      <SheetHeader
        name={detail.name}
        color={color}
        amount={detail.currentAmount}
        meta={meta}
        onClose={onClose}
        onBack={onBack}
      >
        <TagLine records={records} />
        {detail.note && <p className="csheet-note">{detail.note}</p>}
      </SheetHeader>

      {detent === 'full' ? (
        <AllRecords records={records} onEdit={onEdit} />
      ) : (
        <div className="csheet-peek" ref={peekRef}>
          <h3 className="csheet-section-title">金额最大的 {Math.min(TOP_COUNT, records.length)} 笔</h3>
          <ul className="csheet-records">
            {top.map((record) => <RecordRow key={record.id} record={record} onEdit={onEdit} />)}
          </ul>
          {records.length > TOP_COUNT && (
            <button type="button" className="csheet-more" onClick={onExpand}>
              查看全部 {records.length} 笔
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RestBody({ segment, onPick, onClose, peekRef, periodNoun }) {
  return (
    <div className="csheet-body">
      <SheetHeader
        name={segment.name || '其他'}
        color={segment.color}
        amount={segment.amount}
        meta={`占${periodNoun} ${percent(segment.share)} · ${segment.categories.length} 个较小的去向`}
        onClose={onClose}
      />
      <div className="csheet-peek csheet-peek--scroll" ref={peekRef}>
        <ul className="csheet-records">
          {segment.categories.map((category) => (
            <li key={category.name}>
              <button type="button" className="csheet-record csheet-record--link" onClick={() => onPick(category.name)}>
                <span className="csheet-record-text">
                  <strong>{category.name}</strong>
                  <small>占{periodNoun} {percent(category.share)}</small>
                </span>
                <b>{money(category.amount)}</b>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 6 15 12 9 18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * 分类详情浮层。
 * view: { kind: 'category', detail, color, fromRest } | { kind: 'rest', segment } | null
 */
export default function CategorySheet({
  view,
  onClose,
  onPickRestCategory,
  onBackToRest,
  previousPeriodLabel,
  onEditRecord,
  periodNoun = '本期',
}) {
  const [detent, setDetent] = useState('half');
  const [lastView, setLastView] = useState(view);
  const peekRef = useRef(null);
  const open = !!view;

  // 打开或切换到另一个分类时回到半屏；关闭动画期间保留最后的内容
  const viewKey = view ? `${view.kind}:${view.kind === 'rest' ? '其他' : view.detail.name}` : null;
  const lastKey = lastView ? `${lastView.kind}:${lastView.kind === 'rest' ? '其他' : lastView.detail.name}` : null;
  if (view && (viewKey !== lastKey || view !== lastView)) {
    if (viewKey !== lastKey) setDetent('half');
    setLastView(view);
  }

  const shown = view || lastView;
  if (!shown) return null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={shown.kind === 'rest' ? '其他分类' : `${shown.detail.name}的支出`}
      detent={detent}
      onDetentChange={setDetent}
      peekRef={peekRef}
      contentKey={viewKey || lastKey}
      className="csheet"
    >
      {shown.kind === 'rest' ? (
        <RestBody
          key="rest"
          segment={shown.segment}
          onPick={onPickRestCategory}
          onClose={onClose}
          peekRef={peekRef}
          periodNoun={periodNoun}
        />
      ) : (
        <CategoryBody
          key={shown.detail.name}
          detail={shown.detail}
          color={shown.color}
          detent={detent}
          onExpand={() => {
            track('detail_expand');
            setDetent('full');
          }}
          onClose={onClose}
          onBack={shown.fromRest ? onBackToRest : undefined}
          previousPeriodLabel={previousPeriodLabel}
          peekRef={peekRef}
          onEdit={onEditRecord}
        />
      )}
    </Sheet>
  );
}
