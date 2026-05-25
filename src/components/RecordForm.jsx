import { useMemo, useState } from 'react';
import TagInput from './TagInput';
import { toDatetimeLocal } from '../utils/format';
import './RecordForm.css';

const DEFAULT_EXPENSE_DESTINATIONS = ['餐饮', '交通', '咖啡', '购物', '订阅', '日用', '娱乐', '其他'];
const DEFAULT_INCOME_DESTINATIONS = ['工资', '兼职', '理财', '其他'];

function sortCommonDestinations(categories, type) {
  const preferred = type === 'expense' ? DEFAULT_EXPENSE_DESTINATIONS : DEFAULT_INCOME_DESTINATIONS;
  const preferredOrder = new Map(preferred.map((name, index) => [name, index]));
  const existingNames = categories
    .filter((item) => item.type === type)
    .map((item) => item.name)
    .filter((name, index, names) => name && names.indexOf(name) === index);
  const hasOther = existingNames.includes('其他');
  const sortedNames = existingNames
    .filter((name) => name !== '其他')
    .sort((left, right) => {
      const leftOrder = preferredOrder.has(left) ? preferredOrder.get(left) : Number.MAX_SAFE_INTEGER;
      const rightOrder = preferredOrder.has(right) ? preferredOrder.get(right) : Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return existingNames.indexOf(left) - existingNames.indexOf(right);
    });

  return [
    ...sortedNames.slice(0, hasOther ? 7 : 8),
    ...(hasOther ? ['其他'] : []),
  ];
}

export default function RecordForm({
  categories,
  tags,
  onSubmit,
  onManageCategories,
  onManageTags,
}) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [note, setNote] = useState('');
  const [datetime, setDatetime] = useState(toDatetimeLocal());
  const [showMore, setShowMore] = useState(false);
  const [isFixedRecurring, setIsFixedRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('monthly');

  const filteredCategories = useMemo(
    () => categories.filter((item) => item.type === type),
    [categories, type]
  );
  const commonDestinations = useMemo(
    () => sortCommonDestinations(categories, type),
    [categories, type]
  );
  const selectedCategory = filteredCategories.find((item) => item.name === category) || null;
  const availableTags = (() => {
    if (type !== 'expense' || !selectedCategory) {
      return [];
    }

    return tags.filter((tag) => tag.categoryId === selectedCategory.id);
  })();
  const canSubmit = Number(amount) > 0 && !!category;
  const isSubscriptionLike = type === 'expense' && category.includes('订阅');

  const resetAfterSubmit = () => {
    setType('expense');
    setAmount('');
    setCategory('');
    setSelectedTags([]);
    setNote('');
    setDatetime(toDatetimeLocal());
    setShowMore(false);
    setIsFixedRecurring(false);
    setRecurrenceType('monthly');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    if (!category) return;

    onSubmit({
      amount: parsedAmount,
      type,
      category,
      tags: type === 'expense' ? selectedTags : [],
      note,
      datetime: new Date(datetime).toISOString(),
      recurrence: isFixedRecurring ? { type: recurrenceType } : null,
    });

    resetAfterSubmit();
  };

  const handleTypeChange = (nextType) => {
    setType(nextType);
    setCategory('');
    setSelectedTags([]);
  };

  const handleCategoryChange = (nextCategory) => {
    setCategory(nextCategory);
    setSelectedTags([]);
  };

  return (
    <form className="record-form quick-entry" onSubmit={handleSubmit}>
      <section className="quick-entry-hero">
        <span className="quick-entry-kicker">{type === 'expense' ? '今天花了多少？' : '今天收到了多少？'}</span>
        <label className="quick-amount-input">
          <span>¥</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            autoFocus
          />
        </label>
      </section>

      <section className="quick-section">
        <div className="quick-section-head">
          <div>
            <h3>{type === 'expense' ? '常用去向' : '收入来源'}</h3>
            <p>{type === 'expense' ? '选择这笔钱去了哪里。' : '选择这笔钱从哪里来。'}</p>
          </div>
          <button
            type="button"
            className="quick-manage-btn"
            onClick={onManageCategories}
            title="管理分类"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>

        <div className="quick-destination-grid">
          {commonDestinations.map((name) => (
            <button
              key={name}
              type="button"
              className={`quick-destination ${category === name ? 'active' : ''}`}
              onClick={() => handleCategoryChange(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </section>

      {type === 'expense' && selectedCategory && availableTags.length > 0 && (
        <section className="quick-section quick-tags-section">
          <div className="quick-section-head">
            <div>
              <h3>细分标签</h3>
              <p>可选，帮助以后看得更清楚。</p>
            </div>
            <button
              type="button"
              className="quick-manage-btn"
              onClick={() => onManageTags(selectedCategory.id)}
              title="管理标签"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06A1.65 1.65 0 0 1 21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
          <TagInput
            tags={availableTags}
            selectedTags={selectedTags}
            onChange={setSelectedTags}
            emptyMessage=""
          />
        </section>
      )}

      <section className="quick-more">
        <button
          type="button"
          className={`quick-more-toggle ${showMore ? 'expanded' : ''}`}
          onClick={() => setShowMore(!showMore)}
        >
          <span>{showMore ? '收起更多' : '更多'}</span>
          <small>备注 / 时间 / 固定收支</small>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showMore && (
          <div className="quick-more-panel">
            <div className="quick-field">
              <label>记录类型</label>
              <div className="quick-type-switch">
                <button
                  type="button"
                  className={`quick-type-btn ${type === 'expense' ? 'active expense' : ''}`}
                  onClick={() => handleTypeChange('expense')}
                >
                  支出
                </button>
                <button
                  type="button"
                  className={`quick-type-btn ${type === 'income' ? 'active income' : ''}`}
                  onClick={() => handleTypeChange('income')}
                >
                  收入
                </button>
              </div>
            </div>

            <div className="quick-field">
              <label htmlFor="quick-note">备注</label>
              <input
                id="quick-note"
                type="text"
                placeholder="给这笔钱留一句话..."
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <div className="quick-field">
              <label htmlFor="quick-datetime">时间</label>
              <input
                id="quick-datetime"
                type="datetime-local"
                value={datetime}
                onChange={(event) => setDatetime(event.target.value)}
              />
            </div>

            <div className={`quick-fixed-box ${type}`}>
              <label className="quick-fixed-toggle">
                <input
                  type="checkbox"
                  checked={isFixedRecurring}
                  onChange={(event) => setIsFixedRecurring(event.target.checked)}
                />
                <span>{type === 'income' ? '这是固定收入' : '这是固定支出'}</span>
              </label>
              {(isSubscriptionLike || isFixedRecurring) && (
                <p>
                  {type === 'income'
                    ? '固定收入会按周期分摊，让每日净额更接近真实生活。'
                    : (isSubscriptionLike ? '订阅通常适合标记为固定支出。' : '固定支出会在统计中按周期归属。')}
                </p>
              )}
              {isFixedRecurring && (
                <div className="quick-recurrence-switch">
                  <button
                    type="button"
                    className={recurrenceType === 'monthly' ? 'active' : ''}
                    onClick={() => setRecurrenceType('monthly')}
                  >
                    月
                  </button>
                  <button
                    type="button"
                    className={recurrenceType === 'yearly' ? 'active' : ''}
                    onClick={() => setRecurrenceType('yearly')}
                  >
                    年
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <button type="submit" className="quick-submit-btn" disabled={!canSubmit}>
        记录
      </button>
    </form>
  );
}
