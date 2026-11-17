import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

const ENTER_MS = 520;
const SNAP_MS = 460;
const EXIT_MS = 240;
const DRAG_START_PX = 6;
const DISMISS_PX = 96;
const FLICK_PX_PER_MS = 0.55;

const SPRING = 'var(--ease-spring)';
const EXIT_EASE = 'cubic-bezier(0.4, 0, 1, 1)';

let scrollLocks = 0;

function lockPageScroll() {
  scrollLocks += 1;
  if (scrollLocks === 1) document.documentElement.classList.add('sheet-open');
}

function unlockPageScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.documentElement.classList.remove('sheet-open');
}

function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * 底部浮层。
 * - detents 为 ['content']：高度随内容，下拉关闭（普通弹层）。
 * - detents 为 ['half', 'full']：两档高度，半屏露出 peekRef 指向的区域，上拉到全屏，下拉关闭。
 * 拖动只改 transform，不触发 React 重渲染。
 */
export function Sheet({
  open,
  onClose,
  label,
  detent = 'content',
  onDetentChange,
  peekRef,
  contentKey,
  header,
  children,
  className = '',
}) {
  const expandable = detent !== 'content';
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  const sheetRef = useRef(null);
  const overlayRef = useRef(null);
  const offsetRef = useRef(0);
  const halfOffsetRef = useRef(0);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const returnFocusRef = useRef(null);
  const closeRef = useRef(onClose);
  const detentChangeRef = useRef(onDetentChange);

  useEffect(() => {
    closeRef.current = onClose;
    detentChangeRef.current = onDetentChange;
  });

  const offscreen = useCallback(() => (sheetRef.current?.offsetHeight || window.innerHeight) + 24, []);

  const targetFor = useCallback((name) => {
    if (name === 'half') return halfOffsetRef.current;
    return 0;
  }, []);

  const moveTo = useCallback((y, { duration = 0, easing = SPRING } = {}) => {
    const sheet = sheetRef.current;
    const overlay = overlayRef.current;
    if (!sheet) return;
    const ms = reducedMotion() ? Math.min(duration, 1) : duration;
    const transition = ms > 0 ? `transform ${ms}ms ${easing}` : 'none';
    sheet.style.transition = transition;
    sheet.style.transform = `translate3d(0, ${Math.round(y)}px, 0)`;
    offsetRef.current = y;

    if (overlay) {
      const hidden = offscreen();
      const resting = expandable ? halfOffsetRef.current : 0;
      const span = Math.max(hidden - resting, 1);
      const progress = Math.min(1, Math.max(0, 1 - (y - resting) / span));
      overlay.style.transition = ms > 0 ? `opacity ${ms}ms ease-out` : 'none';
      overlay.style.opacity = String(progress);
    }
  }, [expandable, offscreen]);

  const measureHalf = useCallback(() => {
    const sheet = sheetRef.current;
    if (!sheet || !expandable) return;
    const peek = peekRef?.current;
    const sheetHeight = sheet.offsetHeight;
    const visible = peek
      ? Math.min(peek.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top + 12, sheetHeight)
      : sheetHeight * 0.58;
    halfOffsetRef.current = Math.max(0, sheetHeight - visible);
  }, [expandable, peekRef]);

  // 进入 / 退出
  useLayoutEffect(() => {
    if (!mounted) return undefined;
    const sheet = sheetRef.current;
    if (!sheet) return undefined;

    if (open) {
      returnFocusRef.current = document.activeElement;
      lockPageScroll();
      measureHalf();
      moveTo(offscreen());
      const frame = requestAnimationFrame(() => {
        moveTo(targetFor(detent), { duration: ENTER_MS });
        sheet.focus({ preventScroll: true });
      });
      return () => {
        cancelAnimationFrame(frame);
        unlockPageScroll();
      };
    }

    moveTo(offscreen(), { duration: EXIT_MS, easing: EXIT_EASE });
    const timer = setTimeout(() => {
      setMounted(false);
      const previous = returnFocusRef.current;
      if (previous && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    }, reducedMotion() ? 0 : EXIT_MS);
    return () => clearTimeout(timer);
    // detent 变化由下面的 effect 处理，这里只关心打开/关闭
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted]);

  // 切换档位或内容（打开时的初始档位由进入动画负责）
  const lastLayoutRef = useRef({ detent, contentKey });
  useLayoutEffect(() => {
    const last = lastLayoutRef.current;
    if (last.detent === detent && last.contentKey === contentKey) return;
    lastLayoutRef.current = { detent, contentKey };
    if (!open || !mounted || !expandable) return;
    measureHalf();
    moveTo(targetFor(detent), { duration: SNAP_MS });
  }, [detent, contentKey, open, mounted, expandable, measureHalf, moveTo, targetFor]);

  // 视口变化（旋转、键盘）时重新计算半屏位置
  useEffect(() => {
    if (!open || !expandable) return undefined;
    const onResize = () => {
      measureHalf();
      moveTo(targetFor(detent));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, expandable, detent, measureHalf, moveTo, targetFor]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') closeRef.current?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const canDragFrom = (target) => {
    if (target.closest('input, textarea, select')) return false;
    if (target.closest('[data-sheet-grab]')) return true;
    // 半屏时整张浮层都可以拖；全屏时只有顶部抓手区域可以拖，内容区留给滚动
    return expandable && detent === 'half';
  };

  const onPointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (!canDragFrom(event.target)) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startOffset: offsetRef.current,
      active: false,
      samples: [{ y: event.clientY, t: event.timeStamp }],
    };
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dy = event.clientY - drag.startY;
    if (!drag.active) {
      if (Math.abs(dy) < DRAG_START_PX) return;
      drag.active = true;
      try {
        sheetRef.current?.setPointerCapture?.(event.pointerId);
      } catch {
        // 指针已经结束或不是真实指针时拿不到捕获，拖动照常进行
      }
    }
    let y = drag.startOffset + dy;
    if (y < 0) y = -Math.sqrt(-y) * 3; // 顶部橡皮筋阻尼
    moveTo(y);
    drag.samples.push({ y: event.clientY, t: event.timeStamp });
    if (drag.samples.length > 6) drag.samples.shift();
  };

  const finishDrag = (event) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || !drag.active) return;
    suppressClickRef.current = true;
    setTimeout(() => { suppressClickRef.current = false; }, 0);

    const first = drag.samples[0];
    const last = { y: event.clientY, t: event.timeStamp };
    const velocity = last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0;
    const y = offsetRef.current;

    if (!expandable) {
      if (y > DISMISS_PX || velocity > FLICK_PX_PER_MS) {
        closeRef.current?.();
      } else {
        moveTo(0, { duration: SNAP_MS });
      }
      return;
    }

    const half = halfOffsetRef.current;
    let next;
    if (velocity > FLICK_PX_PER_MS) {
      next = detent === 'full' && y < half ? 'half' : 'close';
    } else if (velocity < -FLICK_PX_PER_MS) {
      next = 'full';
    } else {
      const projected = y + velocity * 140;
      const options = [
        { name: 'full', at: 0 },
        { name: 'half', at: half },
        { name: 'close', at: half + DISMISS_PX * 1.4 },
      ];
      next = options.reduce((best, option) => (
        Math.abs(option.at - projected) < Math.abs(best.at - projected) ? option : best
      )).name;
    }

    if (next === 'close') {
      closeRef.current?.();
    } else if (next === detent) {
      moveTo(targetFor(next), { duration: SNAP_MS });
    } else {
      detentChangeRef.current?.(next);
    }
  };

  const onClickCapture = (event) => {
    if (suppressClickRef.current) {
      event.stopPropagation();
      event.preventDefault();
    }
  };

  if (!mounted) return null;

  return createPortal(
    <>
      <div ref={overlayRef} className="sheet-overlay" onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={`sheet ${expandable ? 'sheet--expandable' : 'sheet--content'} ${expandable ? `is-${detent}` : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClickCapture={onClickCapture}
      >
        <div className="sheet-grab" data-sheet-grab>
          <span className="sheet-handle" aria-hidden="true" />
          {header}
        </div>
        {children}
      </div>
    </>,
    document.body
  );
}

export default function Modal({ open, title, onClose, children }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={title}
      header={(
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    >
      <div className="modal-body">
        {children}
      </div>
    </Sheet>
  );
}
