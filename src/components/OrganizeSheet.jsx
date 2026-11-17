import { useMemo, useState } from 'react';
import Modal from './Modal';
import { NAME_MAX, cleanName, nameError, orderDestinations, orphanTags, usageCounter } from '../utils/taxonomy';
import './OrganizeSheet.css';

/** 一行就地改名：回车或「保存」提交，Esc 或「取消」放弃 */
function NameEditor({ initial = '', placeholder, onSave, onCancel }) {
  const [draft, setDraft] = useState(initial);
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
        <button type="button" className="org-editor-save" onClick={save}>保存</button>
        <button type="button" className="org-editor-cancel" onClick={onCancel}>取消</button>
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
  // 正在编辑：{ kind: 'category' | 'tag' | 'new-category' | 'new-tag', id }
  const [editing, setEditing] = useState(null);
  const [tagMenuId, setTagMenuId] = useState('');
  const [adoptId, setAdoptId] = useState('');

  const usage = useMemo(() => usageCounter(data.records), [data.records]);
  const destinations = orderDestinations(data.categories.filter((item) => item.type === type), type);
  const orphans = type === 'expense' ? orphanTags(data) : [];
  const expenseDestinations = orderDestinations(data.categories.filter((item) => item.type === 'expense'), 'expense');
  const noun = type === 'expense' ? '去向' : '来源';

  const switchType = (next) => {
    setType(next);
    setExpandedId('');
    setEditing(null);
    setTagMenuId('');
  };

  const toggle = (id) => {
    setEditing(null);
    setTagMenuId('');
    setExpandedId((current) => (current === id ? '' : id));
  };

  const closeEditor = () => setEditing(null);
  const isEditing = (kind, id) => editing?.kind === kind && editing?.id === id;

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
              {isEditing('category', category.id) ? (
                <NameEditor
                  initial={category.name}
                  placeholder={`${noun}名字`}
                  onSave={(name) => {
                    const result = actions.renameCategory(category.id, name);
                    if (!result?.error) closeEditor();
                    return result;
                  }}
                  onCancel={closeEditor}
                />
              ) : (
                <button type="button" className="org-cat-row" onClick={() => toggle(category.id)} aria-expanded={open}>
                  <span className="org-cat-name">{category.name}</span>
                  <span className="org-count">{count > 0 ? `${count} 笔` : '未使用'}</span>
                  <Chevron open={open} />
                </button>
              )}

              {open && !isEditing('category', category.id) && (
                <div className="org-cat-body">
                  <div className="org-actions">
                    <button type="button" onClick={() => { setTagMenuId(''); setEditing({ kind: 'category', id: category.id }); }}>改名</button>
                    <button type="button" className="is-danger" onClick={() => actions.deleteCategory(category.id)}>删除</button>
                  </div>

                  {type === 'expense' && (
                    <>
                      <div className="org-tags">
                        {categoryTags.map((tag) => {
                          const tagCount = usage.tag(category.name, tag.name);
                          if (isEditing('tag', tag.id)) {
                            return (
                              <NameEditor
                                key={tag.id}
                                initial={tag.name}
                                placeholder="细分名字"
                                onSave={(name) => {
                                  const result = actions.renameTag(tag.id, name);
                                  if (!result?.error) { closeEditor(); setTagMenuId(''); }
                                  return result;
                                }}
                                onCancel={closeEditor}
                              />
                            );
                          }
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              className={`org-tag${tagCount === 0 ? ' is-unused' : ''}${tagMenuId === tag.id ? ' is-active' : ''}`}
                              aria-pressed={tagMenuId === tag.id}
                              onClick={() => { setEditing(null); setTagMenuId((current) => (current === tag.id ? '' : tag.id)); }}
                            >
                              {tag.name}
                              <small>{tagCount}</small>
                            </button>
                          );
                        })}

                        {isEditing('new-tag', category.id) ? (
                          <NameEditor
                            placeholder="新细分名字"
                            onSave={(name) => {
                              const result = actions.addTag(name, category.id);
                              if (!result?.error) closeEditor();
                              return result;
                            }}
                            onCancel={closeEditor}
                          />
                        ) : (
                          <button
                            type="button"
                            className="org-tag org-add"
                            onClick={() => { setTagMenuId(''); setEditing({ kind: 'new-tag', id: category.id }); }}
                          >
                            + 新细分
                          </button>
                        )}
                      </div>

                      {tagMenuId && categoryTags.some((tag) => tag.id === tagMenuId) && (
                        <div className="org-tag-menu">
                          <span>「{categoryTags.find((tag) => tag.id === tagMenuId)?.name}」</span>
                          <button type="button" onClick={() => setEditing({ kind: 'tag', id: tagMenuId })}>改名</button>
                          <button
                            type="button"
                            className="is-danger"
                            onClick={() => {
                              const id = tagMenuId;
                              setTagMenuId('');
                              actions.deleteTag(id);
                            }}
                          >
                            删除
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {isEditing('new-category', type) ? (
        <NameEditor
          placeholder={`新${noun}名字`}
          onSave={(name) => {
            const result = actions.addCategory(name, type);
            if (!result?.error) closeEditor();
            return result;
          }}
          onCancel={closeEditor}
        />
      ) : (
        <button type="button" className="org-new" onClick={() => { setTagMenuId(''); setEditing({ kind: 'new-category', id: type }); }}>
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
                className={`org-tag is-unused${adoptId === tag.id ? ' is-active' : ''}`}
                onClick={() => setAdoptId((current) => (current === tag.id ? '' : tag.id))}
              >
                {tag.name}
              </button>
            ))}
          </div>
          {adoptId && orphans.some((tag) => tag.id === adoptId) && (
            <div className="org-adopt">
              <span>收进</span>
              {expenseDestinations.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    actions.adoptTag(adoptId, category.id);
                    setAdoptId('');
                  }}
                >
                  {category.name}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <p className="org-footnote">
        改名、合并、删除后底部会出现「撤销」。改名前导出的旧备份，合并导入时会带回旧名字。
      </p>
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
