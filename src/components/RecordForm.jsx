import { useState } from 'react';
import DestinationPicker from './DestinationPicker';
import { toDatetimeLocal } from '../utils/format';
import './RecordForm.css';

export default function RecordForm({
  categories,
  tags,
  records,
  tagActions = {},
  onSubmit,
  onManageCategories,
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

  const canSubmit = Number(amount) > 0 && !!category;
  const isSubscriptionLike = type === 'expense' && category.includes('订阅');
  const isIncome = type === 'income';

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

  const toggleType = () => {
    setType(isIncome ? 'expense' : 'income');
    setCategory('');
    setSelectedTags([]);
  };

  return (
    <form className={`record-form quick-entry${isIncome ? ' is-income' : ''}`} onSubmit={handleSubmit}>
      <section className="quick-entry-hero">
        <button
          type="button"
          className="quick-entry-kicker"
          onClick={toggleType}
          aria-label={isIncome ? '当前是收入，点按切换为支出' : '当前是支出，点按切换为收入'}
        >
          <span key={type}>{isIncome ? '收 入' : '支 出'}</span>
        </button>
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
        <div className="amount-hint">{isIncome ? '今天收到了多少？' : '今天花了多少？'}</div>
      </section>

      <DestinationPicker
        type={type}
        categories={categories}
        tags={tags}
        records={records}
        category={category}
        selectedTags={selectedTags}
        onChange={(nextCategory, nextTags) => {
          setCategory(nextCategory);
          setSelectedTags(nextTags);
        }}
        onAddTag={tagActions.onAddTag}
        onRequestRename={tagActions.onRequestRename}
        onDeleteTag={tagActions.onDeleteTag}
        onManageTags={tagActions.onManageTags}
        onOrganize={tagActions.onOrganize}
        onManageCategories={() => onManageCategories?.(type)}
      />

      <section className="quick-more">
        <button
          type="button"
          className={`quick-more-toggle ${showMore ? 'expanded' : ''}`}
          onClick={() => setShowMore(!showMore)}
        >
          <span className="more-dot" /><span className="more-dot" /><span className="more-dot" />
          <small>备注 · 时间 · 周期</small>
        </button>

        {showMore && (
          <div className="quick-more-panel">
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
                <span>{type === 'income' ? '这是周期收入' : '这是周期支出'}</span>
              </label>
              {(isSubscriptionLike || isFixedRecurring) && (
                <p>
                  {type === 'income'
                    ? '周期收入会按天分摊，让每日净额更接近真实生活。'
                    : (isSubscriptionLike ? '订阅通常适合标记为周期支出。' : '周期支出会在统计中按周期归属。')}
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
        落 笔
      </button>
    </form>
  );
}
