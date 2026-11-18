import { useId, useMemo } from 'react';
import './DonutChart.css';

const SIZE = 240;
const CENTER = SIZE / 2;
const RADIUS = 84;
const STROKE = 13;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// 圆角端点向两侧各伸出半个线宽，换算成 pathLength=100 下的长度
const CAP = (STROKE / 2 / CIRCUMFERENCE) * 100;
const GAP = 1.8;
// 小于这个占比的分类按这个宽度画，避免缩成一个点或和邻居粘在一起
const MIN_DISPLAY_SHARE = (GAP + CAP * 2 + 1.2) / 100;
const LIFT_PX = 5;
const HIT_BAND = 34;
const GUIDE_RADIUS = 65;
// 表盘刻度：72 根，每 25% 一根长刻度
const TICK_COUNT = 72;
const TICK_OUTER = 104;
const TICK_INNER = 100;
const TICK_INNER_MAJOR = 97.5;

const TICKS = Array.from({ length: TICK_COUNT }, (_, index) => {
  const turn = index / TICK_COUNT;
  const angle = turn * Math.PI * 2;
  const major = index % (TICK_COUNT / 4) === 0;
  const inner = major ? TICK_INNER_MAJOR : TICK_INNER;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  return {
    index,
    turn,
    major,
    x1: CENTER + sin * inner,
    y1: CENTER - cos * inner,
    x2: CENTER + sin * TICK_OUTER,
    y2: CENTER - cos * TICK_OUTER,
  };
});

function normalizeShares(segments) {
  if (segments.length <= 1) return segments.map(() => 1);
  const raw = segments.map((segment) => Math.max(segment.share, 0));
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;
  const shares = raw.map((value) => value / total);
  const small = shares.map((value) => value < MIN_DISPLAY_SHARE);
  const borrowed = small.reduce((sum, isSmall, index) => (
    isSmall ? sum + (MIN_DISPLAY_SHARE - shares[index]) : sum
  ), 0);
  const largeTotal = shares.reduce((sum, value, index) => (small[index] ? sum : sum + value), 0) || 1;
  return shares.map((value, index) => (
    small[index] ? MIN_DISPLAY_SHARE : value - borrowed * (value / largeTotal)
  ));
}

function buildArcs(segments) {
  const shares = normalizeShares(segments);
  let cursor = 0;
  return segments.map((segment, index) => {
    const share = shares[index];
    const start = cursor * 100;
    const span = share * 100;
    cursor += share;
    const single = segments.length === 1;
    const length = single ? 100 : Math.max(span - GAP - CAP * 2, 0.01);
    const offset = single ? 75 : 75 + start + GAP / 2 + CAP;
    const midAngle = ((start + span / 2) / 100) * Math.PI * 2;
    return {
      ...segment,
      start: start / 100,
      end: (start + span) / 100,
      dashArray: `${length} ${100 - length}`,
      dashOffset: -offset,
      liftX: Math.sin(midAngle) * LIFT_PX,
      liftY: -Math.cos(midAngle) * LIFT_PX,
      single,
    };
  });
}

function arcTransform(arc, lifted) {
  return lifted ? `translate(${arc.liftX}px, ${arc.liftY}px)` : 'translate(0px, 0px)';
}

/**
 * 环形图。segments: [{ name, share, color }]，share 为 0~1。
 * 外圈是表盘刻度，焦点分类（选中的，没选中时是最大的）所在的刻度会点亮，
 * 焦点弧下方垫一层缓慢呼吸的光晕。点击圆环（含周围一圈宽松热区）按角度命中分类；
 * 中心内容由 children 提供。
 */
export default function DonutChart({ segments, selectedName, onSelect, onCenterClick, label, guide, children }) {
  // useId 带有 : 或 « » 这类字符，放进 url(#...) 会失效
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const maskId = `donut-mask-${uid}`;
  const blurId = `donut-blur-${uid}`;
  const arcs = useMemo(() => buildArcs(segments), [segments]);
  const selectedArc = arcs.find((arc) => arc.name === selectedName) || null;
  const focusArc = selectedArc || arcs[0] || null;

  const handleClick = (event) => {
    if (!arcs.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = SIZE / rect.width;
    const x = (event.clientX - rect.left) * scale - CENTER;
    const y = (event.clientY - rect.top) * scale - CENTER;
    const distance = Math.hypot(x, y);
    // 点中间的空心：交给外面（例如打开所选分类的详情）
    if (distance < RADIUS - HIT_BAND) {
      onCenterClick?.();
      return;
    }
    if (distance > RADIUS + HIT_BAND) return;
    let turn = Math.atan2(x, -y) / (Math.PI * 2);
    if (turn < 0) turn += 1;
    const hit = arcs.find((arc) => turn >= arc.start && turn < arc.end) || arcs[arcs.length - 1];
    onSelect(hit.name);
  };

  const isTickLit = (tick) => (
    !!focusArc && (focusArc.single || (tick.turn >= focusArc.start && tick.turn <= focusArc.end))
  );

  return (
    <div className={`donut${selectedArc ? ' has-selection' : ''}`} data-guide={guide}>
      <svg
        className="donut-svg"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={label}
        onClick={handleClick}
      >
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={SIZE} height={SIZE}>
            <circle
              className="donut-reveal"
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              pathLength="100"
              fill="none"
              stroke="#fff"
              strokeWidth="76"
              strokeDasharray="100 100"
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
            />
          </mask>
          <filter id={blurId} filterUnits="userSpaceOnUse" x="0" y="0" width={SIZE} height={SIZE}>
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>

        <g className="donut-ticks" aria-hidden="true">
          {TICKS.map((tick) => {
            const lit = isTickLit(tick);
            return (
              <line
                key={tick.index}
                className={`donut-tick${tick.major ? ' is-major' : ''}${lit ? ' is-lit' : ''}`}
                x1={tick.x1}
                y1={tick.y1}
                x2={tick.x2}
                y2={tick.y2}
                style={{
                  '--tick-delay': `${80 + tick.index * 11}ms`,
                  stroke: lit ? focusArc.color : undefined,
                }}
              />
            );
          })}
        </g>

        <circle className="donut-guide" cx={CENTER} cy={CENTER} r={GUIDE_RADIUS} fill="none" />

        <circle
          className="donut-track"
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
        />

        <g mask={`url(#${maskId})`}>
          {focusArc && (
            <g filter={`url(#${blurId})`}>
              <circle
                className="donut-glow"
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                pathLength="100"
                fill="none"
                strokeWidth="18"
                strokeLinecap={focusArc.single ? 'butt' : 'round'}
                style={{
                  stroke: focusArc.color,
                  strokeDasharray: focusArc.dashArray,
                  strokeDashoffset: focusArc.dashOffset,
                  transform: arcTransform(focusArc, !!selectedArc),
                }}
              />
            </g>
          )}

          {arcs.map((arc) => {
            const selected = arc === selectedArc;
            return (
              <circle
                key={arc.name}
                className={`donut-arc${selected ? ' is-selected' : ''}${selectedArc && !selected ? ' is-dimmed' : ''}`}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                pathLength="100"
                fill="none"
                strokeWidth={STROKE}
                strokeLinecap={arc.single ? 'butt' : 'round'}
                style={{
                  stroke: arc.color,
                  strokeDasharray: arc.dashArray,
                  strokeDashoffset: arc.dashOffset,
                  transform: arcTransform(arc, selected),
                }}
              />
            );
          })}
        </g>
      </svg>

      <div className="donut-center">
        {children}
      </div>
    </div>
  );
}
