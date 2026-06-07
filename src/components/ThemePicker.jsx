import { useState, useRef, useCallback, useEffect } from 'react';
import { THEMES } from '../hooks/useTheme';
import './ThemePicker.css';

const RADIUS = 105;
const N = THEMES.length;
const TAP_THRESHOLD = 8;

export default function ThemePicker({ theme, onChangeTheme }) {
  const [isOpen, setIsOpen] = useState(false);
  const rotationRef = useRef(0);
  const isDraggingRef = useRef(false);
  const dragStartAngle = useRef(0);
  const dragStartRotation = useRef(0);
  const touchStart = useRef({ x: 0, y: 0 });
  const totalMove = useRef(0);
  const lastAngle = useRef(0);
  const velocityRef = useRef(0);
  const lastTime = useRef(0);
  const rafRef = useRef(0);
  const ringAreaRef = useRef(null);
  const dotsRef = useRef([]);
  const labelRef = useRef(null);

  const getCenterOfRing = useCallback(() => {
    const el = ringAreaRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, []);

  const angleFromCenter = useCallback((cx, cy) => {
    const c = getCenterOfRing();
    return Math.atan2(cy - c.y, cx - c.x);
  }, [getCenterOfRing]);

  const normAngle = (a) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

  const positionDots = useCallback(() => {
    const dots = dotsRef.current;
    const rotation = rotationRef.current;
    let focusIdx = -1, minDist = Infinity;

    dots.forEach((dot, i) => {
      if (!dot) return;
      const angle = (i / N) * Math.PI * 2 + rotation - Math.PI / 2;
      const x = Math.cos(angle) * RADIUS;
      const y = Math.sin(angle) * RADIUS;
      const depth = Math.sin(angle);
      const scale = 1.15 - depth * 0.3;
      const opac = Math.min(1, Math.max(0.5, 1.0 - depth * 0.3));

      dot.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      dot.style.opacity = opac;
      dot.style.zIndex = Math.round((1 - depth) * 10);

      const label = dot.querySelector('.ring-dot-label');
      if (label) {
        const deg = normAngle(angle);
        if (deg > Math.PI * 0.25 && deg < Math.PI * 0.75) {
          label.style.cssText = 'top: calc(100% + 6px); left: 50%; transform: translateX(-50%);';
        } else if (deg > Math.PI * 1.25 && deg < Math.PI * 1.75) {
          label.style.cssText = 'bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%);';
        } else if (deg >= Math.PI * 0.75 && deg <= Math.PI * 1.25) {
          label.style.cssText = 'right: calc(100% + 8px); top: 50%; transform: translateY(-50%);';
        } else {
          label.style.cssText = 'left: calc(100% + 8px); top: 50%; transform: translateY(-50%);';
        }
      }

      const distToTop = Math.abs(normAngle(angle) - Math.PI * 1.5);
      const wrapped = distToTop > Math.PI ? Math.PI * 2 - distToTop : distToTop;
      if (wrapped < minDist) { minDist = wrapped; focusIdx = i; }
    });

    dots.forEach((d, i) => {
      if (!d) return;
      d.classList.toggle('focus', i === focusIdx);
      d.classList.toggle('current', THEMES[i].id === theme);
    });

    if (focusIdx >= 0 && labelRef.current) {
      labelRef.current.textContent = THEMES[focusIdx].name;
    }
  }, [theme]);

  const findDotAtPosition = (clientX, clientY) => {
    for (let i = 0; i < dotsRef.current.length; i++) {
      const dot = dotsRef.current[i];
      if (!dot) continue;
      const rect = dot.getBoundingClientRect();
      const pad = 6;
      if (clientX >= rect.left - pad && clientX <= rect.right + pad &&
          clientY >= rect.top - pad && clientY <= rect.bottom + pad) {
        return i;
      }
    }
    return -1;
  };

  const snapToNearest = useCallback(() => {
    const step = (Math.PI * 2) / N;
    const offset = -Math.PI / 2;
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < N; i++) {
      const target = offset - i * step;
      let diff = rotationRef.current - target;
      diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      if (Math.abs(diff) < bestDist) { bestDist = Math.abs(diff); best = i; }
    }
    const target = offset - best * step;
    let diff = target - rotationRef.current;
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;

    const startRot = rotationRef.current;
    const startTime = performance.now();
    const duration = 350;

    const animate = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - t, 4);
      rotationRef.current = startRot + diff * ease;
      positionDots();
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
  }, [positionDots]);

  const applyMomentum = useCallback(() => {
    if (Math.abs(velocityRef.current) < 0.0006) {
      snapToNearest();
      return;
    }
    rotationRef.current += velocityRef.current;
    velocityRef.current *= 0.96;
    positionDots();
    rafRef.current = requestAnimationFrame(applyMomentum);
  }, [positionDots, snapToNearest]);

  const onPointerDown = useCallback((clientX, clientY) => {
    cancelAnimationFrame(rafRef.current);
    dragStartAngle.current = angleFromCenter(clientX, clientY);
    dragStartRotation.current = rotationRef.current;
    isDraggingRef.current = true;
    totalMove.current = 0;
    touchStart.current = { x: clientX, y: clientY };
    lastAngle.current = dragStartAngle.current;
    velocityRef.current = 0;
    lastTime.current = Date.now();
  }, [angleFromCenter]);

  const onPointerMove = useCallback((clientX, clientY) => {
    if (!isDraggingRef.current) return;
    const dx = clientX - touchStart.current.x;
    const dy = clientY - touchStart.current.y;
    totalMove.current = Math.sqrt(dx * dx + dy * dy);

    const angle = angleFromCenter(clientX, clientY);
    let delta = angle - dragStartAngle.current;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    rotationRef.current = dragStartRotation.current + delta;

    const now = Date.now();
    const dt = now - lastTime.current;
    if (dt > 0) {
      let angleDiff = angle - lastAngle.current;
      if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      velocityRef.current = velocityRef.current * 0.4 + (angleDiff / dt * 16) * 0.6;
    }
    lastAngle.current = angle;
    lastTime.current = now;
    positionDots();
  }, [angleFromCenter, positionDots]);

  const onPointerUp = useCallback((clientX, clientY) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (totalMove.current < TAP_THRESHOLD) {
      const dotIdx = findDotAtPosition(clientX, clientY);
      if (dotIdx >= 0) {
        onChangeTheme(THEMES[dotIdx].id);
        setTimeout(() => setIsOpen(false), 200);
        return;
      }
    }

    if (Math.abs(velocityRef.current) > 0.002) {
      applyMomentum();
    } else {
      snapToNearest();
    }
  }, [applyMomentum, snapToNearest, onChangeTheme]);

  useEffect(() => {
    if (isOpen) {
      positionDots();
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isOpen, positionDots]);

  const handleTouchStart = useCallback((e) => {
    const t = e.touches[0];
    onPointerDown(t.clientX, t.clientY);
    e.preventDefault();
  }, [onPointerDown]);

  const handleTouchMove = useCallback((e) => {
    const t = e.touches[0];
    onPointerMove(t.clientX, t.clientY);
    e.preventDefault();
  }, [onPointerMove]);

  const handleTouchEnd = useCallback((e) => {
    const t = e.changedTouches[0];
    onPointerUp(t.clientX, t.clientY);
  }, [onPointerUp]);

  useEffect(() => {
    const el = ringAreaRef.current;
    if (!el || !isOpen) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    const onMouseDown = (e) => { onPointerDown(e.clientX, e.clientY); e.preventDefault(); };
    const onMouseMove = (e) => onPointerMove(e.clientX, e.clientY);
    const onMouseUp = (e) => onPointerUp(e.clientX, e.clientY);
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isOpen, handleTouchStart, handleTouchMove, handleTouchEnd, onPointerDown, onPointerMove, onPointerUp]);

  const currentThemeObj = THEMES.find(t => t.id === theme) || THEMES[0];

  return (
    <>
      <button
        className="palette-trigger"
        onClick={() => setIsOpen(true)}
        style={{ borderColor: currentThemeObj.color }}
      >
        <span className="inner-dot" style={{ background: currentThemeObj.color }} />
      </button>

      <div
        className={`palette-overlay ${isOpen ? 'open' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
      >
        <div className="palette-ring-area" ref={ringAreaRef}>
          <div className="ring-center-label">
            <div className="ring-center-name" ref={labelRef}>
              {currentThemeObj.name}
            </div>
            <div className="ring-center-hint">滑动旋转 · 点击选择</div>
          </div>
          {THEMES.map((t, i) => (
            <div
              key={t.id}
              className={`ring-dot ${t.id === theme ? 'current' : ''}`}
              ref={el => dotsRef.current[i] = el}
              style={{ background: t.color, color: t.color }}
              data-theme={t.id}
            >
              <span className="ring-dot-label">{t.name}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
