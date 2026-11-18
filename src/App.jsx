import { useRef, useState } from 'react';
import Header from './components/Header';
import RecordForm from './components/RecordForm';
import RecordList from './components/RecordList';
import Statistics from './components/Statistics';
import OrganizeSheet from './components/OrganizeSheet';
import TransferSheet from './components/TransferSheet';
import RenameSheet from './components/RenameSheet';
import UndoToast from './components/UndoToast';
import GuideSheet from './components/GuideSheet';
import Spotlight from './components/Spotlight';
import ThemePicker from './components/ThemePicker';
import InstallPrompt from './components/InstallPrompt';
import { useRecords } from './hooks/useRecords';
import { useCategories } from './hooks/useCategories';
import { useTags } from './hooks/useTags';
import { useTheme } from './hooks/useTheme';
import { mergeBackupData, replaceBackupData } from './utils/backup';
import * as taxonomy from './utils/taxonomy';
import { getStorage, setStorage } from './utils/storage';

// 只是界面偏好（看没看过页面指南），不属于记录数据，也不进备份
const GUIDE_SEEN_KEY = 'accounting_guide_seen';

export default function App() {
  const [activeTab, setActiveTab] = useState('add');
  // 整理去向与细分：{ type, focusId } | null
  const [organize, setOrganize] = useState(null);
  // 改名：{ kind: 'category' | 'tag', id, onDone } | null
  const [rename, setRename] = useState(null);
  // 删除前的转移：{ kind: 'tag' | 'category', id, onDone } | null
  const [transfer, setTransfer] = useState(null);
  // 底部提示：{ id, message, snapshot }；snapshot 存在时可撤销
  const [toast, setToast] = useState(null);
  const toastIdRef = useRef(0);
  // 页面指南：清单浮层 + 聚光灯演示
  const [guideOpen, setGuideOpen] = useState(false);
  const [tour, setTour] = useState(null);
  const [guideSeen, setGuideSeen] = useState(() => getStorage(GUIDE_SEEN_KEY, false) === true);
  const tourTimerRef = useRef(0);

  const openGuide = () => {
    setGuideOpen(true);
    if (!guideSeen) {
      setGuideSeen(true);
      setStorage(GUIDE_SEEN_KEY, true);
    }
  };

  // 清单浮层收起后再开始演示，免得聚光灯照到正在下滑的浮层
  const startTour = (steps) => {
    setGuideOpen(false);
    clearTimeout(tourTimerRef.current);
    tourTimerRef.current = setTimeout(() => setTour(steps), 380);
  };
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
  // 改名都在 RenameSheet 里完成：输入时已提示会不会合并，所以保存即生效，6 秒内可撤销
  const requestRename = (kind, id, onDone) => setRename({ kind, id, onDone });

  const saveRename = (name) => {
    if (!rename) return null;
    const result = rename.kind === 'tag'
      ? taxonomy.renameTag(snapshot, rename.id, name)
      : taxonomy.renameCategory(snapshot, rename.id, name);
    const applied = apply(result, rename.onDone);
    if (!applied?.error) setRename(null);
    return applied;
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
    requestRename,
    deleteCategory,
    addTag: (name, categoryId) => apply(taxonomy.addTag(snapshot, name, categoryId)),
    deleteTag,
    adoptTag: (id, categoryId) => apply(taxonomy.adoptTag(snapshot, id, categoryId)),
  };

  // 选择器（记录页 / 补记 / 编辑）用的动作
  const tagActions = {
    onAddTag: (name, categoryId) => organizeActions.addTag(name, categoryId),
    onRequestRename: (tag, onDone) => requestRename('tag', tag.id, onDone),
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
        onGuide={openGuide}
        guideHint={!guideSeen}
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

      <RenameSheet
        request={rename}
        data={snapshot}
        onSave={saveRename}
        onClose={() => setRename(null)}
      />

      <UndoToast toast={toast} onUndo={undo} onDismiss={() => setToast(null)} />

      <GuideSheet
        open={guideOpen}
        tab={activeTab}
        onDemo={startTour}
        onClose={() => setGuideOpen(false)}
      />

      <Spotlight key={tour ? tour[0]?.title : 'none'} steps={tour} onClose={() => setTour(null)} />

      <InstallPrompt />
      <ThemePicker theme={theme} onChangeTheme={setTheme} />
    </>
  );
}
