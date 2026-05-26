import { useMemo, useState } from 'react';
import { getStatisticsInsightViewModel } from '../utils/statistics';
import { formatAmount } from '../utils/format';
import './Statistics.css';

const PERIOD_OPTIONS = [
  { value: 7, label: '近7天' },
  { value: 30, label: '近30天' },
];

const SEGMENT_COLORS = ['#E8A0BF', '#D9B85F', '#8BB8A8', '#8EA4D2', '#D29A8E', '#B8A6D9'];

function money(amount) {
  return `¥${formatAmount(amount || 0)}`;
}

function percent(value) {
  return `${Math.round((value || 0) * 100)}%`;
}

function formatSignedMoney(amount) {
  if (Math.abs(amount || 0) < 0.01) return '持平';
  return `${amount > 0 ? '+' : '-'}${money(Math.abs(amount))}`;
}

function getChangeLabel(item) {
  if (!item) return '';
  if (item.changeState === 'new') return '本期新增';
  if (item.changeState === 'none' || item.changeState === 'flat') return '基本持平';
  return formatSignedMoney(item.changeAmount);
}

function formatRecordDate(dateString) {
  const date = new Date(dateString);
  if (!Number.isFinite(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}

function getRecordDestinationTitle(record) {
  if (Array.isArray(record.tags) && record.tags.length > 0) {
    return record.tags.join(' / ');
  }
  if (record.note) {
    return record.note;
  }
  return '未标记';
}

function PeriodSwitch({ value, onChange }) {
  return (
    <div className="stats-period-switch" aria-label="统计周期">
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`stats-period-option ${value === option.value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function CompositionBar({ segments }) {
  if (!segments.length) return null;

  return (
    <div className="stats-composition-bar" aria-label="分类占比">
      {segments.map((segment, index) => (
        <span
          key={segment.name}
          className="stats-composition-segment"
          title={`${segment.name} ${percent(segment.share)}`}
          style={{
            flexGrow: Math.max(segment.share, 0.02),
            '--segment-color': SEGMENT_COLORS[index % SEGMENT_COLORS.length],
          }}
        />
      ))}
    </div>
  );
}

function CategoryDestination({ vm, activeName, onSelect }) {
  if (!vm.topCategories.length) {
    return (
      <section className="stats-section stats-empty-section">
        <h3>分类去向</h3>
        <p>这段时间还没有可以分析的支出分类。</p>
      </section>
    );
  }

  return (
    <section className="stats-section">
      <div className="stats-section-head">
        <div>
          <h3>钱去了哪里</h3>
          <p>按分类看清本期支出的主要去向。</p>
        </div>
      </div>

      <CompositionBar segments={vm.compositionSegments} />

      <div className="stats-category-list">
        {vm.topCategories.map((category, index) => (
          <button
            key={category.name}
            type="button"
            className={`stats-category-row ${activeName === category.name ? 'active' : ''}`}
            style={{ '--category-color': SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
            onClick={() => onSelect(category.name)}
          >
            <span className="stats-category-main">
              <span className="stats-category-name-line">
                <span className="stats-category-color" aria-hidden="true" />
                <span className="stats-category-name">{category.name}</span>
              </span>
              <span className={`stats-category-change ${category.changeState}`}>
                {getChangeLabel(category)}
              </span>
            </span>
            <span className="stats-category-numbers">
              <strong>{money(category.currentAmount)}</strong>
              <span>{percent(category.share)}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function AttentionCard({ attention }) {
  return (
    <section className={`stats-attention-card ${attention.tone}`}>
      <span className="stats-attention-kicker">值得留意</span>
      <h3>{attention.title}</h3>
      <p>{attention.body}</p>
    </section>
  );
}

function SelectedCategoryDetail({ detail }) {
  if (!detail) {
    return (
      <section className="stats-detail-card">
        <h3>分类细节</h3>
        <p className="stats-muted">记录几笔支出后，这里会展示最主要分类的趋势和最近记录。</p>
      </section>
    );
  }

  return (
    <section className="stats-detail-card">
      <div className="stats-detail-head">
        <div>
          <span className="stats-detail-kicker">当前分类</span>
          <h3>{detail.name}</h3>
        </div>
        <div className="stats-detail-total">
          <strong>{money(detail.currentAmount)}</strong>
          <span>日均 {money(detail.dailyAverage)}</span>
        </div>
      </div>

      <div className="stats-detail-summary">
        <span>占本期 {percent(detail.share)}</span>
        <span>日均 {money(detail.dailyAverage)}</span>
        <span className={detail.changeState}>{getChangeLabel(detail)}</span>
      </div>

      {detail.recentRecords.length > 0 ? (
        <div className="stats-recent-records">
          {detail.recentRecords.map((record) => (
            <div key={record.id} className="stats-recent-row">
              <span>
                <strong>{getRecordDestinationTitle(record)}</strong>
                <small>{formatRecordDate(record.datetime)}</small>
              </span>
              <b>{money(record.amount)}</b>
            </div>
          ))}
        </div>
      ) : (
        <p className="stats-muted">这个分类在当前周期没有支出记录。</p>
      )}
    </section>
  );
}

export default function Statistics({ records }) {
  const [periodDays, setPeriodDays] = useState(7);
  const [selectedCategory, setSelectedCategory] = useState('');

  const vm = useMemo(
    () => getStatisticsInsightViewModel(records, periodDays, selectedCategory),
    [records, periodDays, selectedCategory]
  );

  const activeCategoryName = vm.selectedCategoryDetail?.name || '';

  return (
    <div className="statistics">
      <div className="stats-topbar">
        <div>
          <span className="stats-page-kicker">统计</span>
          <h2>钱到底去了哪里</h2>
        </div>
        <PeriodSwitch value={periodDays} onChange={setPeriodDays} />
      </div>

      <section className="stats-insight-card">
        <div className="stats-insight-copy">
          <span>{vm.periodLabel}</span>
          <h3>{vm.insightTitle}</h3>
          <p>{vm.insightBody}</p>
        </div>
        <div className="stats-insight-total">
          <span>本期支出</span>
          <strong>{money(vm.currentTotal)}</strong>
          <small className={vm.changeState}>{getChangeLabel(vm)}</small>
        </div>
      </section>

      <CategoryDestination
        vm={vm}
        activeName={activeCategoryName}
        onSelect={setSelectedCategory}
      />

      {vm.hasRecords && <AttentionCard attention={vm.attention} />}

      <section className="stats-fixed-card">
        <span>周期收支</span>
        <p>{vm.fixedExpenseSummary.description}</p>
        <p>{vm.fixedIncomeSummary.description}</p>
      </section>

      <SelectedCategoryDetail detail={vm.selectedCategoryDetail} />
    </div>
  );
}
