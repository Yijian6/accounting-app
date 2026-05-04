import { useMemo, useState } from 'react';
import { formatAmount, formatDate } from '../utils/format';
import { getStatisticsViewModel } from '../utils/statistics';
import './Statistics.css';

const PERIOD_OPTIONS = [
  { value: 7, label: '近七日' },
  { value: 30, label: '近三十天' },
];

function buildCurvePath(points) {
  if (!points.length) {
    return '';
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const controlX = (current.x + next.x) / 2;
    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }

  return path;
}

function getChartGeometry(series, width, height) {
  const padding = { top: 12, right: 8, bottom: 20, left: 8 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxAmount = Math.max(...series.map((item) => item.amount), 0);
  const safeMax = maxAmount > 0 ? maxAmount : 1;

  const points = series.map((item, index) => {
    const x = series.length === 1
      ? padding.left + innerWidth / 2
      : padding.left + (innerWidth * index) / (series.length - 1);
    const y = padding.top + innerHeight - (item.amount / safeMax) * innerHeight;
    return { ...item, x, y };
  });

  return {
    padding,
    innerWidth,
    innerHeight,
    baseY: padding.top + innerHeight,
    points,
  };
}

function CurveChart({ series, selectedKey, onSelect }) {
  const width = 320;
  const height = 196;
  const { padding, innerWidth, innerHeight, baseY, points } = getChartGeometry(series, width, height);
  const linePath = buildCurvePath(points);
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`
    : '';
  const peakPoint = points.reduce((peak, point) => {
    if (!peak || point.amount > peak.amount) {
      return point;
    }
    return peak;
  }, null);
  const lastPoint = points[points.length - 1] || null;
  const selectedPoint = points.find((point) => point.key === selectedKey) || null;
  const tickIndices = Array.from(new Set([0, Math.floor((series.length - 1) / 2), series.length - 1]))
    .filter((index) => index >= 0);

  return (
    <div className="curve-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="curve-chart-svg" preserveAspectRatio="none">
        {[0, 1, 2].map((level) => {
          const y = padding.top + (innerHeight * level) / 2;
          return (
            <line
              key={level}
              x1={padding.left}
              x2={padding.left + innerWidth}
              y1={y}
              y2={y}
              className="curve-grid-line"
            />
          );
        })}

        {areaPath && <path d={areaPath} className="curve-area" />}
        {linePath && <path d={linePath} className="curve-line" />}

        {selectedPoint && (
          <line
            x1={selectedPoint.x}
            x2={selectedPoint.x}
            y1={padding.top}
            y2={baseY}
            className="curve-focus-line"
          />
        )}

        {peakPoint && (
          <circle
            cx={peakPoint.x}
            cy={peakPoint.y}
            r={2.8}
            className="curve-point peak"
          />
        )}

        {lastPoint && (
          <>
            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r={3.5}
              className="curve-point last-halo"
            />
            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r={2.7}
              className="curve-point last"
            />
          </>
        )}

        {selectedPoint && (
          <>
            <circle
              cx={selectedPoint.x}
              cy={selectedPoint.y}
              r={7}
              className="curve-point selected-halo"
            />
            <circle
              cx={selectedPoint.x}
              cy={selectedPoint.y}
              r={3.6}
              className="curve-point selected"
            />
          </>
        )}

        {points.map((point) => (
          <circle
            key={`${point.key}-hit`}
            cx={point.x}
            cy={point.y}
            r={12}
            className="curve-hit-area"
            onClick={() => onSelect(point.key)}
          />
        ))}

        {tickIndices.map((index) => {
          const point = points[index];
          return (
            <text
              key={point.key}
              x={point.x}
              y={height - 6}
              textAnchor={index === 0 ? 'start' : index === series.length - 1 ? 'end' : 'middle'}
              className="curve-axis-label"
            >
              {point.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default function Statistics({ records, categories, tags }) {
  const [periodDays, setPeriodDays] = useState(7);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  const [selectedPointKey, setSelectedPointKey] = useState('');

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === 'expense'),
    [categories]
  );

  const categoryOptions = useMemo(
    () => [{ id: 'all', name: '全部分类' }, ...expenseCategories],
    [expenseCategories]
  );

  const activeCategory = categoryOptions.some((item) => (item.id === 'all' ? 'all' : item.name) === selectedCategory)
    ? selectedCategory
    : 'all';

  const tagOptions = useMemo(() => {
    if (activeCategory === 'all') {
      return [{ id: 'all', name: '全部标签' }];
    }

    const category = expenseCategories.find((item) => item.name === activeCategory);
    if (!category) {
      return [{ id: 'all', name: '全部标签' }];
    }

    return [
      { id: 'all', name: '全部标签' },
      ...tags.filter((tag) => tag.categoryId === category.id),
    ];
  }, [activeCategory, expenseCategories, tags]);

  const activeTag = tagOptions.some((item) => (item.id === 'all' ? 'all' : item.name) === selectedTag)
    ? selectedTag
    : 'all';

  const viewModel = useMemo(
    () => getStatisticsViewModel(records, periodDays, activeCategory, activeTag),
    [records, periodDays, activeCategory, activeTag]
  );

  const selectedPoint = viewModel.series.find((point) => point.key === selectedPointKey) || null;

  return (
    <div className="statistics">
      <section className="stats-panel stats-filters-panel">
        <div className="stats-periods">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`stats-period-btn ${periodDays === option.value ? 'active' : ''}`}
              onClick={() => {
                setPeriodDays(option.value);
                setSelectedPointKey('');
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="stats-tags-scroll">
          <div className="stats-tags">
            {categoryOptions.map((category) => {
              const value = category.id === 'all' ? 'all' : category.name;
              return (
                <button
                  key={category.id}
                  className={`stats-tag-btn ${activeCategory === value ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedCategory(value);
                    setSelectedTag('all');
                    setSelectedPointKey('');
                  }}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="stats-tags-scroll">
          <div className="stats-tags">
            {tagOptions.map((tag) => {
              const value = tag.id === 'all' ? 'all' : tag.name;
              return (
                <button
                  key={tag.id}
                  className={`stats-tag-btn ${activeTag === value ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedTag(value);
                    setSelectedPointKey('');
                  }}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>

        {activeCategory !== 'all' && tagOptions.length === 1 && (
          <span className="stats-filter-hint">这个分类下还没有已归属的细分标签。</span>
        )}
      </section>

      <section className="stats-panel stats-chart-panel">
        <div className="stats-chart-head">
          <div className="stats-summary-grid">
            <div className="stats-summary">
              <strong className="stats-summary-amount">{formatAmount(viewModel.totalAmount)}</strong>
              <span className="stats-summary-caption">{viewModel.filterLabel} 总支出</span>
            </div>

            <div className="stats-summary">
              <strong className="stats-summary-amount stats-summary-amount-secondary">
                {formatAmount(viewModel.averageAmount)}
              </strong>
              <span className="stats-summary-caption">
                日均（{viewModel.activeDays} 天）
              </span>
            </div>
          </div>

          {selectedPoint && (
            <div className="chart-readout">
              <strong>{selectedPoint.label}</strong>
              <span>{formatAmount(selectedPoint.amount)}</span>
            </div>
          )}
        </div>

        {viewModel.hasRecords ? (
          <CurveChart
            series={viewModel.series}
            selectedKey={selectedPointKey}
            onSelect={setSelectedPointKey}
          />
        ) : (
          <div className="stats-empty">
            <h3>当前筛选条件下没有支出记录</h3>
            <p>换一个时间范围、分类或细分标签后，这里会显示对应花费曲线。</p>
          </div>
        )}
      </section>

      <section className="stats-panel">
        {viewModel.recentRecords.length > 0 ? (
          <div className="detail-records">
            {viewModel.recentRecords.map((record) => (
              <div key={record.id} className="detail-record">
                <div className="detail-record-main">
                  <span className="detail-record-note">{record.note || record.category}</span>
                  <span className="detail-record-time">{formatDate(record.datetime)}</span>
                </div>
                <strong className="detail-record-amount">{formatAmount(record.amount)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="stats-empty stats-empty-compact">
            <p>当前筛选条件下没有最近记录。</p>
          </div>
        )}
      </section>
    </div>
  );
}
