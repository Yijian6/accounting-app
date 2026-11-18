import './Header.css';

const TABS = [
  { key: 'add', label: '记录' },
  { key: 'list', label: '明细' },
  { key: 'stats', label: '统计' },
];

export default function Header({ activeTab, onTabChange, theme, onGuide, onSettings, guideHint = false }) {
  return (
    <header className="header">
      <div className="header-left">
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
      <button type="button" className="header-settings" onClick={onSettings} aria-label="设置" title="设置">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      </div>
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
