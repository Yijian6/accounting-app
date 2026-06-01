import { useState } from 'react';
import Header from './components/Header';
import RecordForm from './components/RecordForm';
import RecordList from './components/RecordList';
import Statistics from './components/Statistics';
import ManageItems from './components/ManageItems';
import { useRecords } from './hooks/useRecords';
import { useCategories } from './hooks/useCategories';
import { useTags } from './hooks/useTags';
import { mergeBackupData, replaceBackupData } from './utils/backup';

export default function App() {
  const [activeTab, setActiveTab] = useState('add');
  const [manageType, setManageType] = useState(null); // 'categories-expense' | 'categories-income' | 'tags'
  const [manageInitialCategoryId, setManageInitialCategoryId] = useState(null);

  const {
    records,
    addRecord,
    updateRecord,
    deleteRecord,
    renameRecordCategory,
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

  const handleManageCategories = () => {
    setManageType('categories-expense');
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

  const handleReplaceAllData = (payload) => {
    const result = replaceBackupData(payload);
    replaceRecords(result.data.records);
    replaceCategories(result.data.categories);
    replaceTags(result.data.tags);
    return result.summary;
  };

  const getManageItems = () => {
    if (manageType === 'tags') {
      return {
        title: '管理标签',
        itemType: 'tag',
        items: tags,
        categories: getCategoriesByType('expense'),
        onAdd: addTag,
        onUpdate: updateTag,
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
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'add' && (
        <RecordForm
          categories={categories}
          tags={tags}
          onSubmit={(data) => { addRecord(data); setActiveTab('list'); }}
          onManageCategories={handleManageCategories}
          onManageTags={handleManageTags}
        />
      )}

      {activeTab === 'list' && (
        <RecordList
          records={records}
          categories={categories}
          tags={tags}
          snapshot={snapshot}
          onAdd={addRecord}
          onUpdate={updateRecord}
          onDelete={deleteRecord}
          onImportBackup={handleImportBackup}
          onReplaceAllData={handleReplaceAllData}
        />
      )}

      {activeTab === 'stats' && (
        <Statistics records={records} categories={categories} tags={tags} />
      )}

      {manageProps && (
        <ManageItems
          open={true}
          title={manageProps.title}
          itemType={manageProps.itemType}
          items={manageProps.items}
          categories={manageProps.categories}
          initialCategoryId={manageInitialCategoryId}
          onClose={closeManage}
          onAdd={manageProps.onAdd}
          onUpdate={manageProps.onUpdate}
          onDelete={manageProps.onDelete}
        />
      )}
    </>
  );
}
