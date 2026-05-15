import { useEffect, useMemo, useRef, useState } from 'react';
import { formatAmount, getDateGroup, getDateKey } from '../utils/format';
import { getStatisticsViewModel } from '../utils/statistics';
import './Statistics.css';

const PERIOD_OPTIONS = [
  { value: 7, label: '近七日' },
  { value: 30, label: '近三十天' },
];

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function buildCurvePath(points) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const c = points[i];
    const n = points[i + 1];
    const cx = (c.x + n.x) / 2;
    path += ` C ${cx} ${c.y}, ${cx} ${n.y}, ${n.x} ${n.y}`;
  }
  return path;
}

function getChartGeometry(series, width, height) {
  const padding = { top: 12, right: 8, bottom: 20, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const maxAmt = Math.max(...series.map((d) => d.amount), 0);
  const safeMax = maxAmt > 0 ? maxAmt : 1;

  const points = series.map((d, i) => ({
    ...d,
    x: series.length === 1
      ? padding.left + innerW / 2
      : padding.left + (innerW * i) / (series.length - 1),
    y: padding.top + innerH - (d.amount / safeMax) * innerH,
  }));

  return { padding, innerWidth: innerW, innerHeight: innerH, baseY: padding.top + innerH, points };
}

function CurveChart({ series, selectedKey, onSelect }) {
  const W = 320, H = 220;
  const { padding, innerWidth, innerHeight, baseY, points } = getChartGeometry(series, W, H);
  const linePath = buildCurvePath(points);
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`
    : '';
  const peak = points.reduce((p, c) => (!p || c.amount > p.amount ? c : p), null);
  const last = points[points.length - 1] || null;
  const sel = points.find((p) => p.key === selectedKey) || null;
  const ticks = [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])].filter((i) => i >= 0);

  return (
    <div className="curve-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="curve-chart-svg" preserveAspectRatio="none">
        {[0, 1, 2].map((lv) => (
          <line key={lv} x1={padding.left} x2={padding.left + innerWidth}
            y1={padding.top + (innerHeight * lv) / 2} y2={padding.top + (innerHeight * lv) / 2}
            className="curve-grid-line" />
        ))}
        {areaPath && <path d={areaPath} className="curve-area" />}
        {linePath && <path d={linePath} className="curve-line" />}
        {sel && <line x1={sel.x} x2={sel.x} y1={padding.top} y2={baseY} className="curve-focus-line" />}
        {peak && <circle cx={peak.x} cy={peak.y} r={2.8} className="curve-point peak" />}
        {last && (
          <>
            <circle cx={last.x} cy={last.y} r={3.5} className="curve-point last-halo" />
            <circle cx={last.x} cy={last.y} r={2.7} className="curve-point last" />
          </>
        )}
        {sel && (
          <>
            <circle cx={sel.x} cy={sel.y} r={7} className="curve-point selected-halo" />
            <circle cx={sel.x} cy={sel.y} r={3.6} className="curve-point selected" />
          </>
        )}
        {points.map((p) => (
          <circle key={`${p.key}-hit`} cx={p.x} cy={p.y} r={12} className="curve-hit-area"
            onClick={() => onSelect(p.key)} />
        ))}
        {ticks.map((i) => {
          const p = points[i];
          return (
            <text key={p.key} x={p.x} y={H - 6}
              textAnchor={i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'}
              className="curve-axis-label">{p.label}</text>
          );
        })}
      </svg>
    </div>
  );
}

/* ── Compact Stats Card ── */

function CompactStatsCard({ todayAmount, yesterdayAmount, todayLabel, weekSeries, onExpand }) {
  const [displayAmount, setDisplayAmount] = useState(0);
  const [drawn, setDrawn] = useState(false);
  const rafRef = useRef(null);

  // Animated number counting
  useEffect(() => {
    const start = performance.now();
    const dur = 600;
    const step = (now) => {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - (1 - t) * (1 - t); // ease-out quad
      setDisplayAmount(todayAmount * ease);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [todayAmount]);

  // Trigger sparkline draw animation
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Day-over-day comparison
  let changePercent = 0;
  let changeDir = 0;
  if (yesterdayAmount > 0 && todayAmount > 0) {
    changePercent = Math.round(((todayAmount - yesterdayAmount) / yesterdayAmount) * 100);
    changeDir = todayAmount >= yesterdayAmount ? 1 : -1;
  } else if (todayAmount > 0 && yesterdayAmount === 0) {
    changePercent = 100;
    changeDir = 1;
  }

  // Sparkline
  const SW = 280, SH = 52;
  const { points } = getChartGeometry(weekSeries, SW, SH);
  const linePath = buildCurvePath(points);
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${SH} L ${points[0].x} ${SH} Z`
    : '';

  return (
    <button className="compact-card" onClick={onExpand}>
      <div className="compact-card-inner">
        <span className="compact-date">{todayLabel}</span>
        <span className="compact-amount">¥ {formatAmount(displayAmount)}</span>
        {yesterdayAmount > 0 && (
          <span className="compact-compare">
            昨日 ¥{formatAmount(yesterdayAmount)}
            {changeDir !== 0 && (
              <span className={changeDir > 0 ? 'compact-change-up' : 'compact-change-down'}>
                {' '}{changeDir > 0 ? '↑' : '↓'}{Math.abs(changePercent)}%
              </span>
            )}
          </span>
        )}
        {yesterdayAmount === 0 && todayAmount > 0 && (
          <span className="compact-compare">昨日无支出</span>
        )}
        <svg viewBox={`0 0 ${SW} ${SH}`} className="compact-sparkline" preserveAspectRatio="none">
          {areaPath && <path d={areaPath} className="sparkline-area" />}
          {linePath && (
            <path d={linePath} className={`sparkline-line ${drawn ? 'drawn' : ''}`} />
          )}
        </svg>
        <span className="compact-expand-hint">
          详情
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </div>
    </button>
  );
}

/* ── Stats Detail Modal ── */

function StatsDetailModal({ open, onClose, records, categories, tags }) {
  const [periodDays, setPeriodDays] = useState(7);
  const [selCat, setSelCat] = useState('all');
  const [selTag, setSelTag] = useState('all');
  const [selPointKey, setSelPointKey] = useState('');

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const expenseCats = useMemo(() => categories.filter((c) => c.type === 'expense'), [categories]);
  const catOpts = useMemo(() => [{ id: 'all', name: '全部分类' }, ...expenseCats], [expenseCats]);

  const activeCat = catOpts.some((c) => (c.id === 'all' ? 'all' : c.name) === selCat) ? selCat : 'all';

  const tagOpts = useMemo(() => {
    if (activeCat === 'all') return [{ id: 'all', name: '全部标签' }];
    const cat = expenseCats.find((c) => c.name === activeCat);
    if (!cat) return [{ id: 'all', name: '全部标签' }];
    return [{ id: 'all', name: '全部标签' }, ...tags.filter((t) => t.categoryId === cat.id)];
  }, [activeCat, expenseCats, tags]);

  const activeTag = tagOpts.some((t) => (t.id === 'all' ? 'all' : t.name) === selTag) ? selTag : 'all';

  const vm = useMemo(() => getStatisticsViewModel(records, periodDays, activeCat, activeTag), [records, periodDays, activeCat, activeTag]);
  const selPoint = vm.series.find((p) => p.key === selPointKey) || null;

  if (!open) return null;

  return (
    <div className="stats-detail-overlay" onClick={onClose}>
      <div className="stats-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="stats-detail-header">
          <span className="stats-detail-title">支出趋势</span>
          <button className="stats-detail-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="stats-detail-body">
          {/* Filters */}
          <div className="stats-filters">
            <div className="stats-periods">
              {PERIOD_OPTIONS.map((opt) => (
                <button key={opt.value}
                  className={`stats-period-btn ${periodDays === opt.value ? 'active' : ''}`}
                  onClick={() => { setPeriodDays(opt.value); setSelPointKey(''); }}>
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="stats-tags-scroll">
              <div className="stats-tags">
                {catOpts.map((c) => {
                  const v = c.id === 'all' ? 'all' : c.name;
                  return (
                    <button key={c.id}
                      className={`stats-tag-btn ${activeCat === v ? 'active' : ''}`}
                      onClick={() => { setSelCat(v); setSelTag('all'); setSelPointKey(''); }}>
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
            {activeCat !== 'all' && (
              <>
                <div className="stats-tags-scroll">
                  <div className="stats-tags">
                    {tagOpts.map((t) => {
                      const v = t.id === 'all' ? 'all' : t.name;
                      return (
                        <button key={t.id}
                          className={`stats-tag-btn ${activeTag === v ? 'active' : ''}`}
                          onClick={() => { setSelTag(v); setSelPointKey(''); }}>
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {tagOpts.length === 1 && (
                  <span className="stats-filter-hint">这个分类下还没有已归属的细分标签。</span>
                )}
              </>
            )}
          </div>

          {/* Summary + Chart */}
          <div className="stats-chart-section">
            <div className="stats-chart-head">
              <div className="stats-summary-grid">
                <div className="stats-summary">
                  <strong className="stats-summary-amount">{formatAmount(vm.totalAmount)}</strong>
                  <span className="stats-summary-caption">{vm.filterLabel} 总支出</span>
                </div>
                <div className="stats-summary">
                  <strong className="stats-summary-amount stats-summary-amount-secondary">
                    {formatAmount(vm.averageAmount)}
                  </strong>
                  <span className="stats-summary-caption">日均（{vm.activeDays} 天）</span>
                </div>
              </div>
              {selPoint && (
                <div className="chart-readout">
                  <strong>{selPoint.label}</strong>
                  <span>{formatAmount(selPoint.amount)}</span>
                </div>
              )}
            </div>
            {vm.hasRecords ? (
              <CurveChart series={vm.series} selectedKey={selPointKey} onSelect={setSelPointKey} />
            ) : (
              <div className="stats-empty">
                <h3>当前筛选条件下没有支出记录</h3>
                <p>换一个时间范围、分类或细分标签后，这里会显示对应花费曲线。</p>
              </div>
            )}
          </div>

          {/* Recent records */}
          <div className="stats-recent-section">
            {vm.recentRecords.length > 0 ? (
              <div className="detail-records">
                {(() => {
                  let ck = '';
                  return vm.recentRecords.map((r) => {
                    const k = getDateKey(r.datetime);
                    const items = [];
                    if (k !== ck) {
                      ck = k;
                      items.push(<div key={`h-${k}`} className="date-group-header"><span>{getDateGroup(r.datetime)}</span></div>);
                    }
                    items.push(
                      <div key={r.id} className="detail-record">
                        <span className="detail-record-category">{r.note || r.category}</span>
                        <strong className="detail-record-amount">{formatAmount(r.amount)}</strong>
                      </div>
                    );
                    return items;
                  });
                })()}
              </div>
            ) : (
              <div className="stats-empty stats-empty-compact"><p>当前筛选条件下没有最近记录。</p></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Statistics ── */

export default function Statistics({ records, categories, tags }) {
  const [showDetail, setShowDetail] = useState(false);

  const weekVm = useMemo(() => getStatisticsViewModel(records, 7, 'all', 'all'), [records]);

  const lastPoint = weekVm.series[weekVm.series.length - 1];
  const prevPoint = weekVm.series[weekVm.series.length - 2];

  const todayLabel = (() => {
    if (!lastPoint) return '';
    const d = new Date(lastPoint.key);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAY_NAMES[d.getDay()]}`;
  })();

  return (
    <div className="statistics">
      <CompactStatsCard
        todayAmount={lastPoint?.amount || 0}
        yesterdayAmount={prevPoint?.amount || 0}
        todayLabel={todayLabel}
        weekSeries={weekVm.series}
        onExpand={() => setShowDetail(true)}
      />
      <StatsDetailModal
        open={showDetail}
        onClose={() => setShowDetail(false)}
        records={records}
        categories={categories}
        tags={tags}
      />
    </div>
  );
}
