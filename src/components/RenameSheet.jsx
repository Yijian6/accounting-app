import { useState } from 'react';
import Modal from './Modal';
import { NAME_MAX, categoryConflict, cleanName, nameError, tagConflict, usageCounter } from '../utils/taxonomy';
import './RenameSheet.css';

function describeTarget(data, request) {
  if (!request) return null;
  const usage = usageCounter(data.records);
  if (request.kind === 'tag') {
    const tag = data.tags.find((item) => item.id === request.id);
    if (!tag) return null;
    const category = data.categories.find((item) => item.id === tag.categoryId);
    return { noun: '细分', name: tag.name, count: category ? usage.tag(category.name, tag.name) : 0 };
  }
  const category = data.categories.find((item) => item.id === request.id);
  if (!category) return null;
  return { noun: category.type === 'expense' ? '去向' : '来源', name: category.name, count: usage.category(category) };
}

function RenameBody({ data, request, target, onSave }) {
  const [draft, setDraft] = useState(target.name);
  const [error, setError] = useState('');

  const name = cleanName(draft);
  const problem = nameError(name);
  const conflict = !problem && name !== target.name
    ? (request.kind === 'tag' ? tagConflict(data, request.id, name) : categoryConflict(data, request.id, name))
    : null;
  const unchanged = name === target.name;

  let hint = '';
  let tone = '';
  if (error) { hint = error; tone = 'is-error'; }
  else if (problem) { hint = problem; tone = 'is-error'; }
  else if (conflict) { hint = `已有「${conflict.name}」，保存后会把两个合并成一个`; tone = 'is-merge'; }
  else if (!unchanged) { hint = `将改为「${name}」`; }

  const save = () => {
    if (problem || unchanged) return;
    const result = onSave(name);
    if (result?.error) setError(result.error);
  };

  return (
    <div className="rename-sheet">
      <p className="rename-sheet-lead">
        {target.count > 0 ? `用到它的 ${target.count} 笔记录会一起改名` : '还没有记录用过它'}
      </p>
      <input
        value={draft}
        maxLength={NAME_MAX}
        aria-label={`${target.noun}的新名字`}
        onChange={(event) => { setDraft(event.target.value); setError(''); }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); save(); }
        }}
        onFocus={(event) => event.target.select()}
        autoFocus
      />
      <p className={`rename-sheet-hint ${tone}`} aria-live="polite">{hint}</p>
      <button
        type="button"
        className={`rename-sheet-save${conflict ? ' is-merge' : ''}`}
        disabled={!!problem || unchanged}
        onClick={save}
      >
        {conflict ? '合并' : '保存'}
      </button>
    </div>
  );
}

/**
 * 改名浮层：一件事一个界面。输入时就提示结果（改名 / 会合并 / 不能为空），保存后 6 秒内可撤销。
 * request: { kind: 'category' | 'tag', id } | null
 */
export default function RenameSheet({ request, data, onSave, onClose }) {
  const [last, setLast] = useState(request);
  if (request && request !== last) setLast(request);
  const shown = request || last;
  const target = describeTarget(data, shown);

  return (
    <Modal
      open={!!request}
      title={target ? `给${target.noun}「${target.name}」改名` : '改名'}
      onClose={onClose}
    >
      {target && shown && (
        <RenameBody key={`${shown.kind}:${shown.id}`} data={data} request={shown} target={target} onSave={onSave} />
      )}
    </Modal>
  );
}
