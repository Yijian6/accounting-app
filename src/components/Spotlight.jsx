import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './Spotlight.css';

const PAD = 8;
const HEADER_SAFE = 72;
const CAPTION_GAP = 14;
const MEASURE_MS = 700;

function findTarget(target) {
  const candidates = Array.isArray(target) ? target : [target];
  for (const name of candidates) {
    const elements = document.querySelectorAll(`[data-guide="${name}"]`);
    for (const element of elements) {
      if (element.getClientRects().length > 0) return element;
    }
  }
  return null;
}

/**
 * 聚光灯演示：页面变暗，只在真实元素上挖一个圆角亮框，旁边一张小卡片说这一步。
 * 只负责指，不拦截成真正的点击；整层吃掉触摸，避免演示中误改数据。
 */
export default function Spotlight({ steps, onClose }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [captionHeight, setCaptionHeight] = useState(140);
  const captionRef = useRef(null);
  const frameRef = useRef(0);
  const elementRef = useRef(null);

  const step = steps?.[index] || null;
  const last = steps ? index === steps.length - 1 : true;

  const measure = useCallback(() => {
    const element = elementRef.current;
    if (!element || !element.isConnected) {
      setRect(null);
      return;
    }
    const box = element.getBoundingClientRect();
    setRect({ left: box.left, top: box.top, width: box.width, height: box.height });
  }, []);

  // 换一步：找到元素，不在视野里就滚过去，然后在滚动期间持续量位置
  useEffect(() => {
    if (!step) return undefined;
    const element = findTarget(step.target);
    elementRef.current = element;
    if (element) {
      const box = element.getBoundingClientRect();
      const outOfView = box.top < HEADER_SAFE || box.bottom > window.innerHeight - 24;
      if (outOfView) {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const offset = box.top + box.height / 2 - window.innerHeight / 2;
        window.scrollBy({ top: offset, behavior: reduce ? 'auto' : 'smooth' });
      }
    }
    // 先同步量一次，避免第一帧闪出一层没有亮框的暗幕
    measure();
    const startedAt = performance.now();
    const loop = (now) => {
      measure();
      if (now - startedAt < MEASURE_MS) frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [step, measure]);

  useEffect(() => {
    if (!steps) return undefined;
    const onChange = () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(measure);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight' || event.key === 'Enter') {
        setIndex((current) => {
          if (current >= steps.length - 1) {
            onClose();
            return current;
          }
          return current + 1;
        });
      }
    };
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange);
      window.removeEventListener('keydown', onKey);
    };
  }, [steps, measure, onClose]);

  useLayoutEffect(() => {
    if (captionRef.current) setCaptionHeight(captionRef.current.offsetHeight);
  }, [step]);

  if (!steps || !step) return null;

  const viewportH = window.innerHeight;
  const hole = rect && {
    left: rect.left - PAD,
    top: rect.top - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };

  // 卡片放在亮框下方，放不下就放上方，都放不下就放在屏幕中间
  let captionTop = (viewportH - captionHeight) / 2;
  if (hole) {
    const below = hole.top + hole.height + CAPTION_GAP;
    const above = hole.top - CAPTION_GAP - captionHeight;
    if (below + captionHeight <= viewportH - 16) captionTop = below;
    else if (above >= 16) captionTop = above;
  }

  const next = () => {
    if (last) onClose();
    else setIndex((current) => current + 1);
  };

  return createPortal(
    <div className={`spotlight${hole ? '' : ' is-blank'}`} role="dialog" aria-modal="true" aria-label={step.title}>
      {hole && (
        <div
          className="spotlight-hole"
          style={{
            transform: `translate3d(${hole.left}px, ${hole.top}px, 0)`,
            width: hole.width,
            height: hole.height,
            borderRadius: Math.min(18, hole.height / 2),
          }}
        />
      )}

      <div className="spotlight-card" ref={captionRef} style={{ top: captionTop }} key={index}>
        <strong>{step.title}</strong>
        <p>{step.body}</p>
        <div className="spotlight-foot">
          <div className="spotlight-dots" aria-label={`第 ${index + 1} 步，共 ${steps.length} 步`}>
            {steps.map((item, dot) => (
              <i key={item.title + dot} className={dot === index ? 'is-on' : ''} />
            ))}
          </div>
          <div className="spotlight-actions">
            {!last && <button type="button" className="spotlight-skip" onClick={onClose}>跳过</button>}
            <button type="button" className="spotlight-next" onClick={next} autoFocus>
              {last ? '知道了' : '下一步'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
