import { useMemo, useState } from 'react';
import Modal from './Modal';
import { NAME_MAX, cleanName, nameError, orderDestinations, usageCounter } from '../utils/taxonomy';
import './TransferSheet.css';

function Chip({ active, onClick, children, dashed = false }) {
  return (
    <button
      type="button"
      className={`transfer-chip${active ? ' is-active' : ''}${dashed ? ' is-dashed' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** 删除细分：同去向的细分 / 不分细分 / 新建细分 / 别的去向 */
function TagTransfer({ data, tag, category, count, onConfirm }) {
  const [dest, setDest] = useState(null); // { categoryId, tagName }
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState('');
  const [otherId, setOtherId] = useState('');

  const siblings = data.tags.filter((item) => item.categoryId === category.id && item.id !== tag.id);
  const others = orderDestinations(
    data.categories.filter((item) => item.type === 'expense' && item.id !== category.id),
    'expense'
  );
  const other = others.find((item) => item.id === otherId) || null;
  const otherTags = other ? data.tags.filter((item) => item.categoryId === other.id) : [];

  const draftName = cleanName(draft);
  const draftError = drafting && draftName ? nameError(draftName) : '';
  const finalDest = drafting
    ? (draftName && !draftError && draftName !== tag.name ? { categoryId: category.id, tagName: draftName } : null)
    : dest;

  const is = (categoryId, tagName) => !drafting && dest?.categoryId === categoryId && dest?.tagName === tagName;
  const choose = (categoryId, tagName) => {
    setDrafting(false);
    setDest({ categoryId, tagName });
  };

  const targetName = finalDest
    ? (data.categories.find((item) => item.id === finalDest.categoryId)?.name || '')
    : '';

  return (
    <div className="transfer">
      <p className="transfer-lead">
        「{category.name} · {tag.name}」下有 <strong>{count}</strong> 笔记录，删除前先给它们找个去处。
      </p>

      <section className="transfer-group">
        <h4>留在「{category.name}」</h4>
        <div className="transfer-chips">
          {siblings.map((item) => (
            <Chip key={item.id} active={is(category.id, item.name)} onClick={() => choose(category.id, item.name)}>
              {item.name}
            </Chip>
          ))}
          <Chip active={is(category.id, '')} onClick={() => choose(category.id, '')} dashed>不分细分</Chip>
          {drafting ? (
            <span className="transfer-chip is-active is-input">
              <input
                value={draft}
                maxLength={NAME_MAX}
                placeholder="新细分名字"
                aria-label="新细分名字"
                onChange={(event) => setDraft(event.target.value)}
                autoFocus
              />
            </span>
          ) : (
            <Chip active={false} onClick={() => { setDrafting(true); setDest(null); }} dashed>+ 新细分</Chip>
          )}
        </div>
        {draftError && <p className="transfer-error">{draftError}</p>}
      </section>

      {others.length > 0 && (
        <section className="transfer-group">
          <h4>换到别的去向</h4>
          <div className="transfer-chips">
            {others.map((item) => (
              <Chip
                key={item.id}
                active={otherId === item.id}
                onClick={() => {
                  setOtherId(item.id);
                  choose(item.id, '');
                }}
              >
                {item.name}
              </Chip>
            ))}
          </div>
          {other && (
            <div className="transfer-chips transfer-sub">
              <Chip active={is(other.id, '')} onClick={() => choose(other.id, '')} dashed>不分细分</Chip>
              {otherTags.map((item) => (
                <Chip key={item.id} active={is(other.id, item.name)} onClick={() => choose(other.id, item.name)}>
                  {item.name}
                </Chip>
              ))}
            </div>
          )}
        </section>
      )}

      <p className="transfer-summary">
        {finalDest
          ? `${count} 笔会转到「${targetName}${finalDest.tagName ? ` · ${finalDest.tagName}` : ''}」${finalDest.categoryId !== category.id ? '，去向也一起换' : ''}`
          : '选一个去处'}
      </p>

      <button
        type="button"
        className="transfer-submit"
        disabled={!finalDest}
        onClick={() => onConfirm(finalDest)}
      >
        转移并删除「{tag.name}」
      </button>
    </div>
  );
}

/** 删除去向：选一个同类型的去向，记录和细分一起转过去 */
function CategoryTransfer({ data, category, count, onConfirm }) {
  const [targetId, setTargetId] = useState('');
  const others = orderDestinations(
    data.categories.filter((item) => item.type === category.type && item.id !== category.id),
    category.type
  );
  const target = others.find((item) => item.id === targetId) || null;
  const tagCount = data.tags.filter((tag) => tag.categoryId === category.id).length;
  const noun = category.type === 'expense' ? '去向' : '来源';

  return (
    <div className="transfer">
      <p className="transfer-lead">
        「{category.name}」下有 <strong>{count}</strong> 笔记录{tagCount > 0 ? `和 ${tagCount} 个细分` : ''}，删除前先选一个{noun}接收它们。
      </p>

      <section className="transfer-group">
        <h4>转到</h4>
        <div className="transfer-chips">
          {others.map((item) => (
            <Chip key={item.id} active={targetId === item.id} onClick={() => setTargetId(item.id)}>{item.name}</Chip>
          ))}
        </div>
      </section>

      <p className="transfer-summary">
        {target
          ? `${count} 笔会转到「${target.name}」${tagCount > 0 ? '，细分一起带过去，同名的合并' : ''}`
          : `选一个${noun}`}
      </p>

      <button
        type="button"
        className="transfer-submit"
        disabled={!target}
        onClick={() => onConfirm({ categoryId: target.id })}
      >
        转移并删除「{category.name}」
      </button>
    </div>
  );
}

export default function TransferSheet({ request, data, onConfirm, onClose }) {
  const [last, setLast] = useState(request);
  if (request && request !== last) setLast(request);
  const shown = request || last;

  const view = useMemo(() => {
    if (!shown) return null;
    const usage = usageCounter(data.records);
    if (shown.kind === 'tag') {
      const tag = data.tags.find((item) => item.id === shown.id);
      const category = tag && data.categories.find((item) => item.id === tag.categoryId);
      if (!tag || !category) return null;
      return { kind: 'tag', tag, category, count: usage.tag(category.name, tag.name) };
    }
    const category = data.categories.find((item) => item.id === shown.id);
    if (!category) return null;
    return { kind: 'category', category, count: usage.category(category) };
  }, [shown, data]);

  const requestKey = shown ? `${shown.kind}:${shown.id}` : '';

  return (
    <Modal open={!!request} title="删除前先安排记录" onClose={onClose}>
      {view?.kind === 'tag' && (
        <TagTransfer key={requestKey} data={data} {...view} onConfirm={onConfirm} />
      )}
      {view?.kind === 'category' && (
        <CategoryTransfer key={requestKey} data={data} {...view} onConfirm={onConfirm} />
      )}
    </Modal>
  );
}
