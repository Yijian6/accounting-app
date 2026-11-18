/**
 * 匿名使用统计（可在设置里关闭）。
 *
 * - 只记「某天 · 某事件 · 一个很粗的分组 → 次数」，先存在本机队列里，切走应用或每隔一会儿批量发送。
 * - 不带设备 ID：「今天活跃过」由本机记住只发一次；留存用「从哪一周开始用」分组来数。
 * - 不带金额、去向名、细分名、备注、时间点。事件清单见 telemetryEvents.js。
 * - 开发环境（localhost 网页）不发送。
 */
import { TELEMETRY_EVENTS, TELEMETRY_DIM_PATTERN } from './telemetryEvents';

const STATE_KEY = 'accounting_telemetry';
const ENDPOINT = 'https://stats.yijian6.com/collect';
const FLUSH_DELAY_MS = 60 * 1000;

function isNativeApp() {
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
}

function detectPlatform() {
  if (isNativeApp()) {
    const platform = window.Capacitor.getPlatform?.();
    return platform === 'ios' ? 'ios' : 'android';
  }
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  return standalone ? 'pwa' : 'web';
}

// 只在正式构建、且不是本机开发网址时发送（安卓应用的地址也是 localhost，但它是原生壳，照常发送）
const CAN_SEND = typeof window !== 'undefined'
  && import.meta.env.PROD
  && (isNativeApp() || !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname));

function pad(n) {
  return String(n).padStart(2, '0');
}

export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** ISO 周，形如 2026-w47；和看板用同一种算法（都从本地日期字符串算） */
export function isoWeek(day) {
  const d = new Date(`${day}T00:00:00Z`);
  const weekday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - weekday + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-w${pad(week)}`;
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(STATE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      return {
        queue: parsed.queue && typeof parsed.queue === 'object' ? parsed.queue : {},
        cohort: typeof parsed.cohort === 'string' ? parsed.cohort : '',
        lastDay: parsed.lastDay || '',
        lastWeek: parsed.lastWeek || '',
        lastMonth: parsed.lastMonth || '',
      };
    }
  } catch {
    // 读不到就当第一次
  }
  return { queue: {}, cohort: '', lastDay: '', lastWeek: '', lastMonth: '' };
}

let state = typeof window !== 'undefined' ? loadState() : { queue: {} };
let enabled = true;
let flushTimer = 0;

function saveState() {
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // 存不下就算了，统计不能影响记账
  }
}

function scheduleFlush() {
  if (flushTimer || !CAN_SEND) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = 0;
    flush();
  }, FLUSH_DELAY_MS);
}

/** 记一次。name 必须在事件清单里，dim 只能是很短的小写英文分组 */
export function track(name, dim = '') {
  if (!enabled || !Object.hasOwn(TELEMETRY_EVENTS, name)) return;
  const group = String(dim ?? '').toLowerCase();
  if (!TELEMETRY_DIM_PATTERN.test(group)) return;
  const key = `${localDay()}|${name}|${group}`;
  state.queue[key] = (state.queue[key] || 0) + 1;
  saveState();
  scheduleFlush();
}

/** 先用 sendBeacon（切到后台也能送出），不行再用 keepalive 的 fetch；都发不出去就留在队列里下次再试 */
function send(body) {
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: 'text/plain' }))) return true;
  } catch {
    // 换 fetch 再试
  }
  try {
    fetch(ENDPOINT, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true, mode: 'cors' })
      .catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/** 发送队列（text/plain，不触发跨域预检） */
export function flush() {
  if (!enabled || !CAN_SEND) return;
  const keys = Object.keys(state.queue);
  if (keys.length === 0) return;
  const entries = keys.slice(0, 200).map((key) => {
    const [day, name, dim] = key.split('|');
    return [day, name, dim, Math.min(500, state.queue[key])];
  });
  if (send(JSON.stringify({ v: 1, e: entries }))) {
    entries.forEach(([day, name, dim]) => {
      delete state.queue[`${day}|${name}|${dim}`];
    });
    saveState();
  }
}

/** 今天 / 本周 / 本月第一次打开时各记一次活跃；第一次用时记一台新设备 */
function pingActive() {
  if (!enabled) return;
  const day = localDay();
  const week = isoWeek(day);
  const month = day.slice(0, 7);
  if (!state.cohort) {
    state.cohort = week;
    saveState();
    track('new_device', detectPlatform());
  }
  if (state.lastDay !== day) {
    state.lastDay = day;
    saveState();
    track('active_day', detectPlatform());
  }
  if (state.lastWeek !== week) {
    state.lastWeek = week;
    saveState();
    track('active_week', state.cohort);
  }
  if (state.lastMonth !== month) {
    state.lastMonth = month;
    saveState();
    track('active_month');
  }
}

let listening = false;

/** App 启动时调用；开关变化时再调用一次 */
export function setTelemetryEnabled(next) {
  enabled = next !== false;
  if (!enabled) {
    state.queue = {};
    saveState();
    return;
  }
  pingActive();
  if (!listening && typeof document !== 'undefined') {
    listening = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
      else pingActive();
    });
    window.addEventListener('pagehide', () => flush());
  }
}

/** 设置里「看看会发送什么」：本机队列里还没发出去的内容 */
export function pendingEntries() {
  return Object.entries(state.queue).map(([key, count]) => {
    const [day, name, dim] = key.split('|');
    return { day, name, dim, count, label: TELEMETRY_EVENTS[name]?.label || name };
  });
}

export const TELEMETRY_CAN_SEND = CAN_SEND;
