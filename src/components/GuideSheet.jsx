import { useState } from 'react';
import Modal from './Modal';
import { guideFor } from '../utils/guides';
import './GuideSheet.css';

/** 当前页的指南清单：一眼能当速查表看，每条也能「演示」 */
export default function GuideSheet({ open, tab, onDemo, onClose }) {
  // 关闭动画期间保留打开时那一页的内容
  const [shownTab, setShownTab] = useState(tab);
  if (open && tab !== shownTab) setShownTab(tab);
  const guide = guideFor(shownTab);

  return (
    <Modal open={open} title={guide.title} onClose={onClose}>
      <div className="guide">
        <p className="guide-lead">点「演示」会在真实界面上一步步指给你看，不会改动任何数据。</p>
        <ol className="guide-list">
          {guide.items.map((item, index) => (
            <li key={item.title} style={{ '--row': index }}>
              <span className="guide-num" aria-hidden="true">{index + 1}</span>
              <span className="guide-text">
                <strong>{item.title}</strong>
                <small>{item.desc}</small>
              </span>
              <button type="button" className="guide-demo" onClick={() => onDemo(item.steps)}>
                演示
              </button>
            </li>
          ))}
        </ol>
      </div>
    </Modal>
  );
}
