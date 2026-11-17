import { useRef, useState } from 'react';
import Header from './components/Header';
import RecordForm from './components/RecordForm';
import RecordList from './components/RecordList';
import Statistics from './components/Statistics';
import OrganizeSheet from './components/OrganizeSheet';
import TransferSheet from './components/TransferSheet';
import ConfirmSheet from './components/ConfirmSheet';
import UndoToast from './components/UndoToast';
import ThemePicker from './components/ThemePicker';
import InstallPrompt from './components/InstallPrompt';
import { useRecords } from './hooks/useRecords';
import { useCategories } from './hooks/useCategories';
import { useTags } from './hooks/useTags';
import { useTheme } from './hooks/useTheme';
import { mergeBackupData, replaceBackupData } from './utils/backup';
import * as taxonomy from './utils/taxonomy';

export default function App() {
  const [activeTab, setActiveTab] = useState('add');
  // 整理去向与细分：{ type, focusId } | null
  const [organize, setOrganize] = useState(null);
  // 合并前的确认：{ title, body, confirmLabel, onConfirm } | null
  const [confirm, setConfirm] = useState(null);
  // 删除前的转移：{ kind: 'tag' | 'category', id, onDone } | null
  const [transfer, setTransfer] = useState(null);
  // 底部提示：{ id, message, snapshot }；snapshot 存在时可撤销
  const [toast, setToast] = useState(null);
  const toastIdRef = useRef(0);
  const { theme, setTheme } = useTheme();

  const {
    records,
    addRecord,
    updateRecord,
    deleteRecord,
    replaceRecords,
  } = useRecords();
  const { categories, replaceCategories } = useCategories();
  const { tags, replaceTags } = useTags();

  const snapshot = { records, categories, tags };

  const showToast = (message, undoSnapshot = null) => {
    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, message, snapshot: undoSnapshot });
  };

  const writeData = (data) => {
    replaceRecords(data.records);
    replaceCategories(data.categories);
    replaceTags(data.tags);
  };

  /**
   * 落实一次整理操作：先存快照，再一次性写三份数据，最后给出可撤销的提示。
   * 出错时只提示，不改数据。
   */
  const apply = (result, onDone) => {
    if (!result || result.error) {
      if (result?.error) showToast(result.error);
      return result;
    }
    if (!result.unchanged) {
      const before = snapshot;
      writeData(result.data);
      if (result.message) showToast(result.message, before);
    }
    onDone?.(result);
    return result;
  };

  const undo = () => {
    if (!toast?.snapshot) return;
    writeData(toast.snapshot);
    showToast('已撤销');
  };

  // ── 整理动作：所有入口（记录页、补记/编辑、统计、整理面板）都走这里 ──
  const renameCategory = (id, name, onDone) => {
    const clean = taxonomy.cleanName(name);
    const conflict = taxonomy.categoryConflict(snapshot, id, clean);
    if (!conflict || taxonomy.nameError(clean)) return apply(taxonomy.renameCategory(snapshot, id, clean), onDone);

    const source = categories.find((item) => item.id === id);
    const count = taxonomy.usageCounter(records).category(source);
    const tagCount = tags.filter((tag) => tag.categoryId === id).length;
    const parts = [count > 0 ? `${count} 笔记录` : '', tagCount > 0 ? `${tagCount} 个细分` : ''].filter(Boolean).join('和');
    setConfirm({
      title: '合并去向',
      body: `已经有「${conflict.name}」了。${parts ? `「${source.name}」的${parts}会并入「${conflict.name}」，` : ''}「${source.name}」随后移除。`,
      confirmLabel: '合并',
      onConfirm: () => apply(taxonomy.renameCategory(snapshot, id, clean), onDone),
    });
    return { pending: true };
  };

  const renameTag = (id, name, onDone) => {
    const clean = taxonomy.cleanName(name);
    const conflict = taxonomy.tagConflict(snapshot, id, clean);
    if (!conflict || taxonomy.nameError(clean)) return apply(taxonomy.renameTag(snapshot, id, clean), onDone);

    const source = tags.find((item) => item.id === id);
    const category = categories.find((item) => item.id === source.categoryId);
    const count = category ? taxonomy.usageCounter(records).tag(category.name, source.name) : 0;
    setConfirm({
      title: '合并细分',
      body: `「${category?.name || ''}」下已经有「${conflict.name}」了。${count > 0 ? `「${source.name}」的 ${count} 笔记录会并入「${conflict.name}」，` : ''}「${source.name}」随后移除。`,
      confirmLabel: '合并',
      onConfirm: () => apply(taxonomy.renameTag(snapshot, id, clean), onDone),
    });
    return { pending: true };
  };

  const deleteCategory = (id) => {
    const result = taxonomy.deleteCategory(snapshot, id);
    if (result.needsTransfer) {
      setTransfer({ kind: 'category', id });
      return { pending: true };
    }
    return apply(result);
  };

  const deleteTag = (id, onDone) => {
    const result = taxonomy.deleteTag(snapshot, id);
    if (result.needsTransfer) {
      setTransfer({ kind: 'tag', id, onDone });
      return { pending: true };
    }
    return apply(result, onDone);
  };

  const finishTransfer = (destination) => {
    if (!transfer) return;
    const result = transfer.kind === 'tag'
      ? taxonomy.deleteTag(snapshot, transfer.id, destination)
      : taxonomy.deleteCategory(snapshot, transfer.id, destination.categoryId);
    const applied = apply(result, transfer.onDone);
    if (!applied?.error) setTransfer(null);
  };

  const organizeActions = {
    addCategory: (name, type) => apply(taxonomy.addCategory(snapshot, name, type)),
    renameCategory,
    deleteCategory,
    addTag: (name, categoryId) => apply(taxonomy.addTag(snapshot, name, categoryId)),
    renameTag,
    deleteTag,
    adoptTag: (id, categoryId) => apply(taxonomy.adoptTag(snapshot, id, categoryId)),
  };

  // 选择器（记录页 / 补记 / 编辑）用的动作
  const tagActions = {
    onAddTag: (name, categoryId) => organizeActions.addTag(name, categoryId),
    onRenameTag: (tag, name, onDone) => renameTag(tag.id, name, onDone),
    onDeleteTag: (tag, onDone) => deleteTag(tag.id, onDone),
    onManageTags: (categoryId) => setOrganize({ type: 'expense', focusId: categoryId || null }),
    onOrganize: ({ type = 'expense', focusId = null } = {}) => setOrganize({ type, focusId }),
  };

  const handleImportBackup = (payload, mode) => {
    const currentData = snapshot;
    const result = mode === 'replace'
      ? replaceBackupData(payload)
      : mergeBackupData(currentData, payload);

    replaceRecords(result.data.records);
    replaceCategories(result.data.categories);
    replaceTags(result.data.tags);

    return result.summary;
  };

  return (
    <>
      <Header
        theme={theme}
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab !== activeTab) window.scrollTo(0, 0);
          setActiveTab(tab);
        }}
      />

      <main key={activeTab} className="page-view">
      {activeTab === 'add' && (
        <RecordForm
          categories={categories}
          tags={tags}
          records={records}
          tagActions={tagActions}
          onSubmit={(data) => { addRecord(data); setActiveTab('list'); }}
          onManageCategories={(type) => tagActions.onOrganize({ type })}
        />
      )}

      {activeTab === 'list' && (
        <RecordList
          records={records}
          categories={categories}
          tags={tags}
          onAdd={addRecord}
          onUpdate={updateRecord}
          onDelete={deleteRecord}
          onImportBackup={handleImportBackup}
          tagActions={tagActions}
          onOrganize={() => tagActions.onOrganize({ type: 'expense' })}
        />
      )}

      {activeTab === 'stats' && (
        <Statistics
          records={records}
          categories={categories}
          tags={tags}
          tagActions={tagActions}
          onUpdate={updateRecord}
        />
      )}
      </main>

      <OrganizeSheet
        open={!!organize}
        initialType={organize?.type}
        focusId={organize?.focusId}
        sessionKey={organize ? `${organize.type}:${organize.focusId || ''}` : ''}
        data={snapshot}
        actions={organizeActions}
        onClose={() => setOrganize(null)}
      />

      <TransferSheet
        request={transfer}
        data={snapshot}
        onConfirm={finishTransfer}
        onClose={() => setTransfer(null)}
      />

      <ConfirmSheet
        request={confirm}
        onClose={() => setConfirm(null)}
      />

      <UndoToast toast={toast} onUndo={undo} onDismiss={() => setToast(null)} />

      <InstallPrompt />
      <ThemePicker theme={theme} onChangeTheme={setTheme} />
    </>
  );
}
