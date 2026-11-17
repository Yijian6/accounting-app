import { useState } from 'react';
import { exportDataBook } from '../utils/dataBookExport';
import './DataBookExport.css';

const RANGE_OPTIONS = [
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
  { value: 'all', label: '全部' },
];

const FORMAT_OPTIONS = [
  { value: 'html', label: 'HTML' },
  { value: 'xlsx', label: 'Excel' },
  { value: 'json', label: 'JSON' },
];

function ChoiceRow({ label, options, value, onChange }) {
  return (
    <div className="data-book-field">
      <span>{label}</span>
      <div className="data-book-choices" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? 'active' : ''}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * 数据册导出：放在「明细」页的数据管理里。
 * onExport(label, task) 由父组件提供，负责统一的成功/失败反馈；
 * task 必须同步发起保存（iOS 分享面板要求在点击的同步调用链里打开）。
 */
export default function DataBookExport({ records, onExport }) {
  const [rangeType, setRangeType] = useState('month');
  const [format, setFormat] = useState('html');

  return (
    <div className="data-book">
      <div className="data-book-head">
        <strong>数据册</strong>
        <span>HTML 适合查看，Excel 适合继续分析，JSON 保存基础数据。</span>
      </div>

      <ChoiceRow label="范围" options={RANGE_OPTIONS} value={rangeType} onChange={setRangeType} />
      <ChoiceRow label="格式" options={FORMAT_OPTIONS} value={format} onChange={setFormat} />

      <button
        type="button"
        className="export-option-btn"
        onClick={() => onExport('数据册', () => exportDataBook(records, { rangeType, format }))}
      >
        导出数据册
      </button>
    </div>
  );
}
