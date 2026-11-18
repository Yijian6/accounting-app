import { useMemo, useState } from 'react';
import Modal from './Modal';
import ActionMenu, { InboxIcon, PencilIcon, TrashIcon } from './ActionMenu';
import { NAME_MAX, cleanName, nameError, orderDestinations, orphanTags, usageCounter } from '../utils/taxonomy';
import './OrganizeSheet.css';

/** 新建时的一行输入：回车或「添加」提交，Esc 或「取消」放弃 */
function NameEditor({ placeholder, onSave, onCancel }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const save = () => {
    const name = cleanName(draft);
    const problem = nameError(name);
    if (problem) {
      setError(problem);
      return;
    }
    const result = onSave(name);
    if (result?.error) setError(result.error);
  };

  return (
    <div className="org-editor">
      <div className="org-editor-row">
        <input
          value={draft}
          maxLength={NAME_MAX}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(event) => { setDraft(event.target.value); setError(''); }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); save(); }
            if (event.key === 'Escape') onCancel();
          }}
          autoFocus
        />
        <button type="button" className="org-editor-save" onClick={save}>添加</button>
        <button type="button" className="org-editor-cancel" onClick={onCancel} aria-label="取消">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {error && <p className="org-error">{error}</p>}
    </div>
  );
}

function Chevron({ open }) {
  return (
    <svg className={`org-chevron${open ? ' is-open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

function OrganizeBody({ initialType, focusId, data, actions }) {
  const [type, setType] = useState(initialType || 'expense');
  const [expandedId, setExpandedId] = useState(focusId || '');
  // 正在新建：{ kind: 'new-category' | 'new-tag', id }
  const [adding, setAdding] = useState(null);
  // 操作菜单：{ ownerId, anchor, title, items }
  const [menu, setMenu] = useState(null);

  const usage = useMemo(() => usageCounter(data.records), [data.records]);
  const destinations = orderDestinations(data.categories.filter((item) => item.type === type), type);
  const orphans = type === 'expense' ? orphanTags(data) : [];
  const expenseDestinations = orderDestinations(data.categories.filter((item) => item.type === 'expense'), 'expense');
  const noun = type === 'expense' ? '去向' : '来源';

  const switchType = (next) => {
    setType(next);
    setExpandedId('');
    setAdding(null);
  };

  const toggle = (id) => {
    setAdding(null);
    setExpandedId((current) => (current === id ? '' : id));
  };

  const openMenu = (event, ownerId, title, items) => {
    setMenu({ ownerId, anchor: event.currentTarget.getBoundingClientRect(), title, items });
  };

  const categoryMenu = (event, category, count) => openMenu(event, category.id, `${noun}「${category.name}」 · ${count} 笔`, [
    { key: 'rename', label: '改名', icon: <PencilIcon />, onSelect: () => actions.requestRename('category', category.id) },
    { key: 'delete', label: '删除', icon: <TrashIcon />, danger: true, onSelect: () => actions.deleteCategory(category.id) },
  ]);

  const tagMenu = (event, tag, count) => openMenu(event, tag.id, `细分「${tag.name}」 · ${count} 笔`, [
    { key: 'rename', label: '改名', icon: <PencilIcon />, onSelect: () => actions.requestRename('tag', tag.id) },
    { key: 'delete', label: '删除', icon: <TrashIcon />, danger: true, onSelect: () => actions.deleteTag(tag.id) },
  ]);

  const adoptMenu = (event, tag) => openMenu(event, tag.id, `把「${tag.name}」收进哪个去向`,
    expenseDestinations.map((category) => ({
      key: category.id,
      label: category.name,
      icon: <InboxIcon />,
      onSelect: () => actions.adoptTag(tag.id, category.id),
    })));

  return (
    <div className="organize">
      <div className="org-switch" role="group" aria-label="类型">
        <span className="org-switch-thumb" style={{ transform: `translate3d(${type === 'income' ? 100 : 0}%, 0, 0)` }} aria-hidden="true" />
        <button type="button" className={type === 'expense' ? 'active' : ''} aria-pressed={type === 'expense'} onClick={() => switchType('expense')}>支出去向</button>
        <button type="button" className={type === 'income' ? 'active' : ''} aria-pressed={type === 'income'} onClick={() => switchType('income')}>收入来源</button>
      </div>

      <ul className="org-list">
        {destinations.map((category) => {
          const open = expandedId === category.id;
          const count = usage.category(category);
          const categoryTags = data.tags.filter((tag) => tag.categoryId === category.id);

          return (
            <li key={category.id} className={`org-cat${open ? ' is-open' : ''}`}>
              <div className="org-cat-head">
                <button
                  type="button"
                  className="org-cat-row"
                  onClick={(event) => (type === 'expense' ? toggle(category.id) : categoryMenu(event, category, count))}
                  aria-expanded={type === 'expense' ? open : undefined}
                >
                  <span className="org-cat-name">{category.name}</span>
                  <span className="org-count">{count > 0 ? `${count} 笔` : '未使用'}</span>
                  {type === 'expense' && <Chevron open={open} />}
                </button>
                <button
                  type="button"
                  className={`org-more${menu?.ownerId === category.id ? ' is-active' : ''}`}
                  aria-label={`${category.name}的更多操作`}
                  onClick={(event) => categoryMenu(event, category, count)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="5" cy="12" r="1.7" />
                    <circle cx="12" cy="12" r="1.7" />
                    <circle cx="19" cy="12" r="1.7" />
                  </svg>
                </button>
              </div>

              {open && type === 'expense' && (
                <div className="org-cat-body">
                  <div className="org-tags">
                    {categoryTags.map((tag) => {
                      const tagCount = usage.tag(category.name, tag.name);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          className={`org-tag${tagCount === 0 ? ' is-unused' : ''}${menu?.ownerId === tag.id ? ' is-active' : ''}`}
                          aria-haspopup="menu"
                          onClick={(event) => tagMenu(event, tag, tagCount)}
                        >
                          {tag.name}
                          <small>{tagCount}</small>
                        </button>
                      );
                    })}

                    {adding?.kind === 'new-tag' && adding.id === category.id ? (
                      <NameEditor
                        placeholder="新细分名字"
                        onSave={(name) => {
                          const result = actions.addTag(name, category.id);
                          if (!result?.error) setAdding(null);
                          return result;
                        }}
                        onCancel={() => setAdding(null)}
                      />
                    ) : (
                      <button
                        type="button"
                        className="org-add"
                        onClick={() => setAdding({ kind: 'new-tag', id: category.id })}
                      >
                        + 新细分
                      </button>
                    )}
                  </div>
                  {categoryTags.length > 0 && <p className="org-tip">点细分可以改名或删除</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {adding?.kind === 'new-category' ? (
        <NameEditor
          placeholder={`新${noun}名字`}
          onSave={(name) => {
            const result = actions.addCategory(name, type);
            if (!result?.error) setAdding(null);
            return result;
          }}
          onCancel={() => setAdding(null)}
        />
      ) : (
        <button type="button" className="org-new" onClick={() => setAdding({ kind: 'new-category', id: type })}>
          + 新{noun}
        </button>
      )}

      {orphans.length > 0 && (
        <section className="org-orphans">
          <h4>未归属的细分</h4>
          <p>早先建的、或去向被删后留下的，点一下选择收进哪个去向。</p>
          <div className="org-tags">
            {orphans.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={`org-tag is-unused${menu?.ownerId === tag.id ? ' is-active' : ''}`}
                aria-haspopup="menu"
                onClick={(event) => adoptMenu(event, tag)}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <p className="org-footnote">
        改名、合并、删除后底部会出现「撤销」。改名前导出的旧备份，合并导入时会带回旧名字。
      </p>

      <ActionMenu request={menu} onClose={() => setMenu(null)} />
    </div>
  );
}

/** 整理去向与细分：树状列出每个去向和它的细分，以及各自用了多少笔 */
export default function OrganizeSheet({ open, initialType, focusId, sessionKey, data, actions, onClose }) {
  const [lastKey, setLastKey] = useState(sessionKey);
  const [lastProps, setLastProps] = useState({ initialType, focusId });
  if (open && sessionKey !== lastKey) {
    setLastKey(sessionKey);
    setLastProps({ initialType, focusId });
  }

  return (
    <Modal open={open} title="整理去向与细分" onClose={onClose}>
      <OrganizeBody
        key={lastKey}
        initialType={lastProps.initialType}
        focusId={lastProps.focusId}
        data={data}
        actions={actions}
      />
    </Modal>
  );
}
