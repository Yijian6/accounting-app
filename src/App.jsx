import { useState } from 'react';
import Header from './components/Header';
import RecordForm from './components/RecordForm';
import RecordList from './components/RecordList';
import Statistics from './components/Statistics';
import ManageItems from './components/ManageItems';
import ThemePicker from './components/ThemePicker';
import InstallPrompt from './components/InstallPrompt';
import { useRecords } from './hooks/useRecords';
import { useCategories } from './hooks/useCategories';
import { useTags } from './hooks/useTags';
import { useTheme } from './hooks/useTheme';
import { mergeBackupData, replaceBackupData } from './utils/backup';

export default function App() {
  const [activeTab, setActiveTab] = useState('add');
  const [manageType, setManageType] = useState(null); // 'categories-expense' | 'categories-income' | 'tags'
  const [manageInitialCategoryId, setManageInitialCategoryId] = useState(null);
  const { theme, setTheme } = useTheme();

  const {
    records,
    addRecord,
    updateRecord,
    deleteRecord,
    renameRecordCategory,
    renameRecordTag,
    replaceRecords,
  } = useRecords();
  const {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    replaceCategories,
    getCategoriesByType,
  } = useCategories();
  const { tags, addTag, updateTag, deleteTag, replaceTags } = useTags();

  const snapshot = { records, categories, tags };

  const handleManageCategories = (type = 'expense') => {
    setManageType(type === 'income' ? 'categories-income' : 'categories-expense');
  };

  const handleManageTags = (categoryId) => {
    setManageType('tags');
    setManageInitialCategoryId(categoryId || null);
  };

  const closeManage = () => {
    setManageType(null);
    setManageInitialCategoryId(null);
  };

  const handleUpdateCategory = (id, name) => {
    const category = categories.find((item) => item.id === id);
    updateCategory(id, name);
    if (category) {
      renameRecordCategory(category.type, category.name, name);
    }
  };

  // 细分改名时，这个去向下用旧名字的记录一起改；移到别的去向则不动旧记录
  const handleUpdateTag = (id, name, categoryId = null) => {
    const tag = tags.find((item) => item.id === id);
    updateTag(id, name, categoryId);
    if (!tag || !tag.categoryId || tag.categoryId !== categoryId) return;
    const category = categories.find((item) => item.id === tag.categoryId);
    if (category) {
      renameRecordTag(category.name, tag.name, name);
    }
  };

  const tagActions = {
    onAddTag: addTag,
    onRenameTag: (tag, name) => handleUpdateTag(tag.id, name, tag.categoryId),
    onDeleteTag: (tag) => deleteTag(tag.id),
    onManageTags: handleManageTags,
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

  const getManageItems = () => {
    if (manageType === 'tags') {
      const expenseCategories = getCategoriesByType('expense');
      const scope = expenseCategories.find((item) => item.id === manageInitialCategoryId) || null;
      const knownIds = new Set(expenseCategories.map((item) => item.id));
      // 没有归属、或归属的去向已被删掉的细分：放进「未归属」，可以一键收进当前去向
      const orphans = tags.filter((tag) => !tag.categoryId || !knownIds.has(tag.categoryId));
      return {
        title: scope ? `${scope.name} · 细分` : '管理细分',
        itemType: 'tag',
        items: scope ? tags.filter((tag) => tag.categoryId === scope.id) : tags,
        categories: expenseCategories,
        scopeCategoryId: scope?.id || null,
        orphans: scope ? orphans : [],
        onAdd: addTag,
        onUpdate: handleUpdateTag,
        onDelete: deleteTag,
      };
    }
    if (manageType === 'categories-expense') {
      return {
        title: '管理支出分类',
        itemType: 'category',
        items: getCategoriesByType('expense'),
        onAdd: (name) => addCategory(name, 'expense'),
        onUpdate: handleUpdateCategory,
        onDelete: deleteCategory,
      };
    }
    if (manageType === 'categories-income') {
      return {
        title: '管理收入分类',
        itemType: 'category',
        items: getCategoriesByType('income'),
        onAdd: (name) => addCategory(name, 'income'),
        onUpdate: handleUpdateCategory,
        onDelete: deleteCategory,
      };
    }
    return null;
  };

  const manageProps = getManageItems();

  return (
    <>
      <Header
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
          onManageCategories={handleManageCategories}
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

      {manageProps && (
        <ManageItems
          open={true}
          title={manageProps.title}
          itemType={manageProps.itemType}
          items={manageProps.items}
          categories={manageProps.categories}
          initialCategoryId={manageInitialCategoryId}
          scopeCategoryId={manageProps.scopeCategoryId}
          orphans={manageProps.orphans}
          onClose={closeManage}
          onAdd={manageProps.onAdd}
          onUpdate={manageProps.onUpdate}
          onDelete={manageProps.onDelete}
        />
      )}

      <InstallPrompt />
      <ThemePicker theme={theme} onChangeTheme={setTheme} />
    </>
  );
}
