import { useMemo, useState } from 'react';
import Modal from './Modal';
import { getStatisticsInsightViewModel } from '../utils/statistics';
import { formatAmount } from '../utils/format';
import { exportDataBook } from '../utils/dataBookExport';
import './Statistics.css';

const PERIOD_OPTIONS = [
  { value: 7, label: '近7天' },
  { value: 30, label: '近30天' },
];

const SEGMENT_COLORS = ['#E8A0BF', '#D9B85F', '#8BB8A8', '#8EA4D2', '#D29A8E', '#B8A6D9'];

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

function getRecordSubtitle(record) {
  const dateLabel = getRecordDateLabel(record);
  const hasTags = Array.isArray(record.tags) && record.tags.length > 0;
  const note = typeof record.note === 'string' ? record.note.trim() : '';

  if (hasTags && note) {
    return `${note} · ${dateLabel}`;
  }

  return dateLabel;
}

function getRecordDisplayAmount(record) {
  return Number.isFinite(record.attributedAmount) ? record.attributedAmount : record.amount;
}

function getRecordDateLabel(record) {
  const date = formatRecordDate(record.datetime);
  return record.isAttributedAmount ? `${date} · 本期归属` : date;
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
      <span className="stats-attention-kicker">变化</span>
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
                <small>{getRecordSubtitle(record)}</small>
              </span>
              <b>{money(getRecordDisplayAmount(record))}</b>
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
  const [showDataExport, setShowDataExport] = useState(false);
  const [exportRangeType, setExportRangeType] = useState('month');
  const [exportFormat, setExportFormat] = useState('html');

  const vm = useMemo(
    () => getStatisticsInsightViewModel(records, periodDays, selectedCategory),
    [records, periodDays, selectedCategory]
  );

  const activeCategoryName = vm.selectedCategoryDetail?.name || '';

  const handleDataBookExport = () => {
    exportDataBook(records, {
      rangeType: exportRangeType,
      format: exportFormat,
    });
    setShowDataExport(false);
  };

  return (
    <div className="statistics">
      <div className="stats-topbar">
        <div>
          <span className="stats-page-kicker">统计</span>
          <h2>钱去了哪里</h2>
        </div>
        <div className="stats-top-actions">
          <button
            type="button"
            className="stats-export-btn"
            onClick={() => setShowDataExport(true)}
            title="导出数据册"
            aria-label="导出数据册"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <PeriodSwitch value={periodDays} onChange={setPeriodDays} />
        </div>
      </div>

      <section className="stats-insight-card">
        <div className="stats-insight-copy">
          <span>{vm.periodLabel}</span>
          <h3>{vm.insightTitle}</h3>
          <p>{vm.insightBody}</p>
        </div>
        <div className="stats-insight-total">
          <span>本期已看见</span>
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
        <span>周期归属</span>
        <p>{vm.fixedExpenseSummary.description}</p>
        <p>{vm.fixedIncomeSummary.description}</p>
      </section>

      <SelectedCategoryDetail detail={vm.selectedCategoryDetail} />

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
