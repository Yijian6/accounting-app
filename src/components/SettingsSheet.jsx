import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import DataManager from './DataManager';
import { TELEMETRY_CAN_SEND, pendingEntries } from '../utils/telemetry';
import './SettingsSheet.css';

/* global __BUILD_DATE__ */
const BUILD_DATE = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : '开发版';
const DASHBOARD_URL = 'https://stats.yijian6.com/';
const UNLOCK_TAPS = 5;

const RAIL_OPTIONS = [
  { value: 'left', label: '去向在左', hint: '细分在右' },
  { value: 'right', label: '去向在右', hint: '细分在左' },
];

/** 一张缩略图：滚轮、分割线、大括号和细分的相对位置 */
function SideDiagram({ side }) {
  return (
    <span className={`side-diagram is-${side}`} aria-hidden="true">
      <span className="side-rail">
        <i />
        <i className="is-on" />
        <i />
      </span>
      <span className="side-line" />
      <span className="side-brace" />
      <span className="side-tags">
        <i />
        <i />
        <i className="is-short" />
      </span>
    </span>
  );
}

/** 匿名使用统计：开关 + 说清楚发什么、不发什么 + 能看到即将发送的原文 */
function TelemetrySection({ enabled, onToggle }) {
  const [showPending, setShowPending] = useState(false);
  const pending = showPending ? pendingEntries() : [];

  return (
    <section className="settings-group">
      <h3>隐私</h3>
      <label className="settings-switch">
        <span>
          <strong>帮助改进拾序</strong>
          <small>匿名统计功能被用了多少次，帮我知道哪里好用、哪里不好用</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={enabled}
          onChange={(event) => onToggle(event.target.checked)}
        />
        <i aria-hidden="true" />
      </label>
      <div className="settings-privacy">
        <p><b>会发送</b>：每天打开过、落笔和各功能被点的次数，以及在浏览器、主屏幕还是安卓应用里用。</p>
        <p><b>永远不发送</b>：金额、去向和细分的名字、备注、具体时间，也没有任何能认出你的标识。</p>
        <button type="button" className="settings-text-btn" onClick={() => setShowPending((value) => !value)}>
          {showPending ? '收起' : '看看这台设备即将发送的内容'}
        </button>
        {showPending && (
          <div className="settings-pending">
            {pending.length === 0 ? (
              <span>现在没有待发送的内容。</span>
            ) : (
              pending.map((item) => (
                <span key={`${item.day}|${item.name}|${item.dim}`}>
                  {item.day} · {item.label}{item.dim ? `（${item.dim}）` : ''} × {item.count}
                </span>
              ))
            )}
            {!TELEMETRY_CAN_SEND && <span className="is-muted">当前是开发版，不会真的发送。</span>}
          </div>
        )}
      </div>
    </section>
  );
}

/** 关于：版本号；连点 5 次出现「数据看板」入口（看板本身另有登录保护） */
function AboutSection() {
  const [taps, setTaps] = useState(0);
  const unlocked = taps >= UNLOCK_TAPS;

  return (
    <section className="settings-group">
      <h3>关于</h3>
      <button
        type="button"
        className="settings-about"
        onClick={() => setTaps((value) => value + 1)}
        aria-label={`拾序，构建于 ${BUILD_DATE}`}
      >
        <strong>拾序</strong>
        <span>构建于 {BUILD_DATE}</span>
      </button>
      {unlocked && (
        <a className="settings-link settings-dashboard" href={DASHBOARD_URL} target="_blank" rel="noopener noreferrer">
          <span>
            <strong>数据看板</strong>
            <small>需要用你的邮箱验证登录</small>
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </a>
      )}
    </section>
  );
}

function SettingsBody({ focus, prefs, onPrefsChange, onOpenGuide, dataProps }) {
  const dataRef = useRef(null);

  // 从明细页的齿轮进来时，直接停在「数据」这一段
  useEffect(() => {
    if (focus !== 'data') return undefined;
    const timer = setTimeout(() => {
      dataRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 380);
    return () => clearTimeout(timer);
  }, [focus]);

  return (
    <div className="settings">
      <section className="settings-group">
        <h3>记账</h3>
        <div className="settings-label">
          <strong>去向的位置</strong>
          <span>选更顺手的一边，记录、补记、编辑都会跟着换</span>
        </div>
        <div className="settings-sides" role="radiogroup" aria-label="去向的位置">
          {RAIL_OPTIONS.map((option) => {
            const active = prefs.railSide === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                className={`settings-side${active ? ' is-active' : ''}`}
                onClick={() => onPrefsChange({ railSide: option.value })}
              >
                <SideDiagram side={option.value} />
                <strong>{option.label}</strong>
                <small>{option.hint}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="settings-group">
        <h3>帮助</h3>
        <button type="button" className="settings-link" onClick={onOpenGuide}>
          <span>
            <strong>这一页怎么用</strong>
            <small>也可以随时点左上角的「拾序」</small>
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </button>
      </section>

      <section className="settings-group" ref={dataRef}>
        <h3>数据</h3>
        <DataManager {...dataProps} />
      </section>

      <TelemetrySection enabled={prefs.telemetry} onToggle={(value) => onPrefsChange({ telemetry: value })} />

      <AboutSection />
    </div>
  );
}

/**
 * 设置：记账习惯、帮助、数据管理。数据管理只在这里实现一份，明细页的齿轮也打开这里。
 */
export default function SettingsSheet({ open, focus, sessionKey, prefs, onPrefsChange, onOpenGuide, dataProps, onClose }) {
  const [lastKey, setLastKey] = useState(sessionKey);
  const [lastFocus, setLastFocus] = useState(focus);
  if (open && sessionKey !== lastKey) {
    setLastKey(sessionKey);
    setLastFocus(focus);
  }

  return (
    <Modal open={open} title="设置" onClose={onClose}>
      <SettingsBody
        key={lastKey}
        focus={lastFocus}
        prefs={prefs}
        onPrefsChange={onPrefsChange}
        onOpenGuide={onOpenGuide}
        dataProps={dataProps}
      />
    </Modal>
  );
}
