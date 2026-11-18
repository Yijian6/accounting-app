import './Header.css';

const TABS = [
  { key: 'add', label: '记录' },
  { key: 'list', label: '明细' },
  { key: 'stats', label: '统计' },
];

export default function Header({ activeTab, onTabChange, theme, onGuide, guideHint = false }) {
  return (
    <header className="header">
      <button
        type="button"
        className="header-brand"
        onClick={onGuide}
        aria-label="拾序 · 这一页怎么用"
        title="这一页怎么用"
      >
        {theme && (
          <img
            key={theme}
            className="header-icon"
            src={`${import.meta.env.BASE_URL}theme-icons/${theme}-192.png`}
            alt=""
            width="22"
            height="22"
            decoding="async"
          />
        )}
        <span className="header-logo">拾序</span>
        {guideHint && <span className="header-hint" aria-hidden="true" />}
      </button>
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
