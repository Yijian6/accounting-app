import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import DataManager from './DataManager';
import './SettingsSheet.css';

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
