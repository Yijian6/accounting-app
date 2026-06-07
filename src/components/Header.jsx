import './Header.css';

const TABS = [
  { key: 'add', label: '记录' },
  { key: 'list', label: '明细' },
  { key: 'stats', label: '统计' },
];

export default function Header({ activeTab, onTabChange }) {
  return (
    <header className="header">
      <span className="header-logo">拾序</span>
      <nav className="header-nav">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`header-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
