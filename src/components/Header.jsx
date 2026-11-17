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
        <span
          className="header-indicator"
          aria-hidden="true"
          style={{ transform: `translate3d(${Math.max(0, TABS.findIndex((tab) => tab.key === activeTab)) * 100}%, 0, 0)` }}
        />
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            className={`header-tab ${activeTab === tab.key ? 'active' : ''}`}
            aria-current={activeTab === tab.key ? 'page' : undefined}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
