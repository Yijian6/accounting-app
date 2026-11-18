import { useState } from 'react';
import Modal from './Modal';
import DestinationPicker from './DestinationPicker';
import { track } from '../utils/telemetry';
import { toDatetimeLocal } from '../utils/format';
import './RecordEditor.css';

function formFromRecord(record) {
  return {
    amount: record?.amount != null ? String(record.amount) : '',
    type: record?.type || 'expense',
    category: record?.category || '',
    tags: Array.isArray(record?.tags) ? [...record.tags] : [],
    note: record?.note || '',
    datetime: record?.datetime ? toDatetimeLocal(record.datetime) : toDatetimeLocal(),
    recurrence: record?.recurrence || null,
  };
}

/**
 * 补记与编辑共用的记账浮层，和记录页用同一个去向选择器。
 * 由父组件用 key 控制每次打开时重新挂载，从 initial 取初值。
 */
export default function RecordEditor({
  open,
  title,
  dateNote,
  initial,
  submitLabel = '落 笔',
  categories,
  tags,
  records,
  tagActions = {},
  onSubmit,
  onClose,
}) {
  const [form, setForm] = useState(() => formFromRecord(initial));
  const [showMore, setShowMore] = useState(false);

  const update = (patch) => setForm((current) => ({ ...current, ...patch }));
  const amount = parseFloat(form.amount);
  const date = new Date(form.datetime);
  const canSubmit = Number.isFinite(amount) && amount > 0 && !!form.category && !Number.isNaN(date.getTime());
  const isIncome = form.type === 'income';

  const switchType = () => {
    track('type_toggle');
    update({ type: isIncome ? 'expense' : 'income', category: '', tags: [] });
  };

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      amount,
      type: form.type,
      category: form.category,
      tags: form.type === 'expense' ? form.tags : [],
      note: form.note || '',
      datetime: date.toISOString(),
      recurrence: form.recurrence || null,
    });
  };

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="record-editor">
        {dateNote && <div className="record-editor-date">{dateNote}</div>}

        <div className="record-editor-top">
          <button
            type="button"
            className={`type-toggle${isIncome ? ' is-income' : ''}`}
            onClick={switchType}
            aria-label={isIncome ? '当前是收入，点按切换为支出' : '当前是支出，点按切换为收入'}
          >
            <span key={form.type}>{isIncome ? '收 入' : '支 出'}</span>
          </button>

          <label className={`record-editor-amount${isIncome ? ' is-income' : ''}`}>
            <span>{isIncome ? '+' : '-'}</span>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0.00"
              value={form.amount}
              onChange={(event) => update({ amount: event.target.value })}
            />
          </label>
        </div>

        <DestinationPicker
          type={form.type}
          categories={categories}
          tags={tags}
          records={records}
          category={form.category}
          selectedTags={form.tags}
          onChange={(category, nextTags) => update({ category, tags: nextTags })}
          onAddTag={tagActions.onAddTag}
          onRequestRename={tagActions.onRequestRename}
          onDeleteTag={tagActions.onDeleteTag}
          onManageTags={tagActions.onManageTags}
          onOrganize={tagActions.onOrganize}
          keepUnknownTags={!!initial?.id}
        />

        <button
          type="button"
          className={`record-editor-more${showMore ? ' expanded' : ''}`}
          onClick={() => setShowMore((value) => !value)}
          aria-expanded={showMore}
        >
          <span className="more-dot" /><span className="more-dot" /><span className="more-dot" />
          <small>备注 · 时间 · 周期</small>
        </button>

        {showMore && (
          <div className="record-editor-panel">
            <input
              type="text"
              placeholder="给这笔钱留一句话..."
              value={form.note}
              onChange={(event) => update({ note: event.target.value })}
            />
            <input
              type="datetime-local"
              value={form.datetime}
              onChange={(event) => update({ datetime: event.target.value })}
            />
            <div className={`record-editor-fixed${isIncome ? ' is-income' : ''}`}>
              <label>
                <input
                  type="checkbox"
                  checked={!!form.recurrence}
                  onChange={(event) => update({
                    recurrence: event.target.checked ? { type: form.recurrence?.type || 'monthly' } : null,
                  })}
                />
                <span>{isIncome ? '这是周期收入' : '这是周期支出'}</span>
              </label>
              {form.recurrence && (
                <div className="record-editor-recurrence">
                  <button
                    type="button"
                    className={form.recurrence.type === 'monthly' ? 'active' : ''}
                    onClick={() => update({ recurrence: { type: 'monthly' } })}
                  >
                    月
                  </button>
                  <button
                    type="button"
                    className={form.recurrence.type === 'yearly' ? 'active' : ''}
                    onClick={() => update({ recurrence: { type: 'yearly' } })}
                  >
                    年
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <button type="button" className="record-editor-submit" onClick={submit} disabled={!canSubmit}>
          {submitLabel}
        </button>
      </div>
    </Modal>
  );
}
