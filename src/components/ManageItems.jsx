import { useMemo, useState } from 'react';
import Modal from './Modal';
import './ManageItems.css';

export default function ManageItems({
  open,
  title,
  items,
  itemType,
  categories = [],
  initialCategoryId = null,
  onClose,
  onAdd,
  onUpdate,
  onDelete,
}) {
  const [newName, setNewName] = useState('');
  const [newCategoryId, setNewCategoryId] = useState(initialCategoryId || '');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');

  const categoryNameMap = useMemo(
    () => Object.fromEntries(categories.map((category) => [category.id, category.name])),
    [categories]
  );

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;

    if (itemType === 'tag') {
      onAdd(name, newCategoryId || null);
      setNewCategoryId('');
    } else {
      onAdd(name);
    }

    setNewName('');
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditCategoryId(item.categoryId || '');
  };

  const saveEdit = () => {
    const name = editName.trim();
    if (!name) return;

    if (itemType === 'tag') {
      onUpdate(editingId, name, editCategoryId || null);
    } else {
      onUpdate(editingId, name);
    }

    setEditingId(null);
    setEditName('');
    setEditCategoryId('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditCategoryId('');
  };

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="manage-items">
        <div className="manage-add">
          <input
            type="text"
            placeholder="输入名称..."
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleAdd()}
          />
          <button className="add-btn" onClick={handleAdd} disabled={!newName.trim()}>
            添加
          </button>
        </div>

        {itemType === 'tag' && (
          <div className="manage-meta-row">
            <label className="manage-meta-field">
              <span>归属分类</span>
              <select value={newCategoryId} onChange={(event) => setNewCategoryId(event.target.value)}>
                <option value="">未归属</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="manage-list">
          {items.map((item) => (
            <div key={item.id} className="manage-item">
              {editingId === item.id ? (
                <div className="manage-edit-stack">
                  <div className="manage-edit-row">
                    <input
                      type="text"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') saveEdit();
                        if (event.key === 'Escape') cancelEdit();
                      }}
                      autoFocus
                    />
                    <button className="save-btn" onClick={saveEdit}>保存</button>
                    <button className="cancel-btn" onClick={cancelEdit}>取消</button>
                  </div>

                  {itemType === 'tag' && (
                    <div className="manage-meta-row">
                      <label className="manage-meta-field">
                        <span>归属分类</span>
                        <select value={editCategoryId} onChange={(event) => setEditCategoryId(event.target.value)}>
                          <option value="">未归属</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              ) : (
                <div className="manage-item-row">
                  <div className="manage-item-copy">
                    <span className="manage-item-name">{item.name}</span>
                    {itemType === 'tag' && (
                      <span className="manage-item-meta">
                        {item.categoryId ? (categoryNameMap[item.categoryId] || '未归属') : '未归属'}
                      </span>
                    )}
                  </div>

                  <div className="manage-item-actions">
                    <button className="edit-btn" onClick={() => startEdit(item)}>编辑</button>
                    <button className="delete-btn" onClick={() => onDelete(item.id)}>删除</button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {items.length === 0 && (
            <div className="manage-empty">暂无项目</div>
          )}
        </div>
      </div>
    </Modal>
  );
}
