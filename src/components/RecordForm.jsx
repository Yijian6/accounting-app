import { useState } from 'react';
import TagInput from './TagInput';
import { toDatetimeLocal } from '../utils/format';
import './RecordForm.css';

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

  const filteredCategories = categories.filter((item) => item.type === type);
  const selectedCategory = filteredCategories.find((item) => item.name === category) || null;
  const availableTags = (() => {
    if (type !== 'expense' || !selectedCategory) {
      return [];
    }

    return tags.filter((tag) => tag.categoryId === selectedCategory.id);
  })();

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    if (!category) return;

    onSubmit({
      amount: parseFloat(amount),
      type,
      category,
      tags: selectedTags,
      note,
      datetime: new Date(datetime).toISOString(),
    });

    setAmount('');
    setCategory('');
    setSelectedTags([]);
    setNote('');
    setDatetime(toDatetimeLocal());
    setShowMore(false);
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
    <form className="record-form" onSubmit={handleSubmit}>
      <div className="type-switch">
        <button
          type="button"
          className={`type-btn ${type === 'expense' ? 'active expense' : ''}`}
          onClick={() => handleTypeChange('expense')}
        >
          支出
        </button>
        <button
          type="button"
          className={`type-btn ${type === 'income' ? 'active income' : ''}`}
          onClick={() => handleTypeChange('income')}
        >
          收入
        </button>
      </div>

      <div className="amount-input">
        <span className="amount-symbol">{type === 'expense' ? '-' : '+'}</span>
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          autoFocus
        />
      </div>

      <div className="form-section">
        <div className="category-grid-wrap">
          <div className="category-grid">
            {filteredCategories.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`category-item ${category === item.name ? 'active' : ''}`}
                onClick={() => handleCategoryChange(item.name)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <button type="button" className="manage-icon-btn" onClick={onManageCategories} title="管理分类">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {type === 'expense' && (
        <div className="form-section">
          <div className="category-grid-wrap">
            <TagInput
              tags={availableTags}
              selectedTags={selectedTags}
              onChange={setSelectedTags}
              emptyMessage={selectedCategory ? '这个分类下还没有细分标签' : '先选分类，再选细分标签'}
            />
            <button type="button" className="manage-icon-btn" onClick={() => onManageTags(selectedCategory?.id)} title="管理标签">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className={`more-toggle ${showMore ? 'expanded' : ''}`}
        onClick={() => setShowMore(!showMore)}
      >
        {showMore ? '收起' : '更多选项'}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {showMore && (
        <div className="more-section">
          <input
            type="text"
            placeholder="添加备注..."
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <input
            type="datetime-local"
            value={datetime}
            onChange={(event) => setDatetime(event.target.value)}
          />
        </div>
      )}

      <button type="submit" className="submit-btn" disabled={!amount || !category}>
        记录
      </button>
    </form>
  );
}
