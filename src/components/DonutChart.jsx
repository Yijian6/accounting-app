import { useId, useMemo } from 'react';
import './DonutChart.css';

const SIZE = 220;
const CENTER = SIZE / 2;
const RADIUS = 84;
const STROKE = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// 圆角端点向两侧各伸出半个线宽，换算成 pathLength=100 下的长度
const CAP = (STROKE / 2 / CIRCUMFERENCE) * 100;
const GAP = 1.6;
// 小于这个占比的分类按这个宽度画，避免缩成一个点或和邻居粘在一起
const MIN_DISPLAY_SHARE = (GAP + CAP * 2 + 1.2) / 100;
const LIFT_PX = 7;
const HIT_BAND = 34;

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

/**
 * 环形图。segments: [{ name, share, color }]，share 为 0~1。
 * 点击圆环（含周围一圈宽松热区）按角度命中分类；中心内容由 children 提供。
 */
export default function DonutChart({ segments, selectedName, onSelect, label, children }) {
  // useId 带有 : 或 « » 这类字符，放进 url(#...) 会失效
  const maskId = `donut-mask-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const arcs = useMemo(() => buildArcs(segments), [segments]);
  const hasSelection = arcs.some((arc) => arc.name === selectedName);

  const handleClick = (event) => {
    if (!arcs.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = SIZE / rect.width;
    const x = (event.clientX - rect.left) * scale - CENTER;
    const y = (event.clientY - rect.top) * scale - CENTER;
    const distance = Math.hypot(x, y);
    if (distance < RADIUS - HIT_BAND || distance > RADIUS + HIT_BAND) return;
    let turn = Math.atan2(x, -y) / (Math.PI * 2);
    if (turn < 0) turn += 1;
    const hit = arcs.find((arc) => turn >= arc.start && turn < arc.end) || arcs[arcs.length - 1];
    onSelect(hit.name);
  };

  return (
    <div className="donut">
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
              strokeWidth={STROKE + LIFT_PX * 2 + 8}
              strokeDasharray="100 100"
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
            />
          </mask>
        </defs>

        <circle
          className="donut-track"
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
        />

        <g mask={`url(#${maskId})`}>
          {arcs.map((arc) => {
            const selected = arc.name === selectedName;
            return (
              <circle
                key={arc.name}
                className={`donut-arc${selected ? ' is-selected' : ''}${hasSelection && !selected ? ' is-dimmed' : ''}`}
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
                  transform: selected ? `translate(${arc.liftX}px, ${arc.liftY}px)` : 'translate(0px, 0px)',
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
