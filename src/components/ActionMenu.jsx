import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ActionMenu.css';

const MENU_WIDTH = 208;
const EDGE = 12;

export function PencilIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </svg>
  );
}

export function InboxIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 13l2.5-7h11L20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5z" />
      <path d="M4 13h4l1.5 2.5h5L16 13h4" />
    </svg>
  );
}

/**
 * 操作菜单：从被点的那个元素旁边浮起一块面板，第一行写清对象，下面是带图标的操作。
 * 和细分胶囊在形状上完全不同，避免把「操作」看成「数据」。
 * request: { anchor: DOMRect, title, items: [{ key, label, icon, danger, onSelect }] } | null
 */
export default function ActionMenu({ request, onClose }) {
  const panelRef = useRef(null);
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    if (!request || !panelRef.current) return;
    const { anchor } = request;
    const height = panelRef.current.offsetHeight;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const left = Math.min(Math.max(EDGE, anchor.left), viewportW - MENU_WIDTH - EDGE);
    const below = anchor.bottom + 8;
    const fitsBelow = below + height <= viewportH - EDGE;
    const top = fitsBelow ? below : Math.max(EDGE, anchor.top - height - 8);
    // 从锚点那一侧展开
    const originX = Math.min(Math.max(anchor.left + anchor.width / 2 - left, 16), MENU_WIDTH - 16);
    setPosition({ left, top, origin: `${originX}px ${fitsBelow ? 'top' : 'bottom'}` });
  }, [request]);

  useEffect(() => {
    if (!request) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [request, onClose]);

  if (!request) return null;

  return createPortal(
    <div className="action-menu-layer" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        ref={panelRef}
        className={`action-menu${position ? ' is-placed' : ''}`}
        role="menu"
        aria-label={request.title}
        style={position
          ? { left: position.left, top: position.top, transformOrigin: position.origin, width: MENU_WIDTH }
          : { left: -9999, top: 0, width: MENU_WIDTH }}
      >
        {request.title && <div className="action-menu-title">{request.title}</div>}
        <div className="action-menu-items">
          {request.items.map((item) => (
            <button
              key={item.key || item.label}
              type="button"
              role="menuitem"
              className={`action-menu-item${item.danger ? ' is-danger' : ''}`}
              onClick={() => {
                onClose();
                item.onSelect();
              }}
            >
              <span>{item.label}</span>
              {item.icon}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
