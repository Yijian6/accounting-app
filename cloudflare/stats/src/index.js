/**
 * 拾序 · 匿名使用统计
 *
 * POST /collect     应用上报计数（只收白名单事件，只累加次数）
 * GET  /api/summary 看板数据（必须通过 Cloudflare Access 登录）
 * GET  /            看板页面（同上）
 *
 * 数据库里只有「日期 × 事件 × 分组 → 次数」，没有设备 ID、IP、金额或任何记账内容。
 */
import { TELEMETRY_EVENTS, TELEMETRY_DIM_PATTERN } from '../../../src/utils/telemetryEvents.js';
import DASHBOARD_HTML from './dashboard.html';

const MAX_BODY_BYTES = 16 * 1024;
const MAX_ENTRIES = 200;
const MAX_COUNT = 500;
const KEEP_DAYS = 400;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const ALLOWED_ORIGINS = new Set([
  'https://money.yijian6.com',
  'https://accounting-app-9f0.pages.dev',
  'https://localhost', // Android 应用（Capacitor）
  'capacitor://localhost', // iOS 应用（Capacitor）
]);

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Pages 的预览部署：xxxx.accounting-app-9f0.pages.dev
  return /^https:\/\/[a-z0-9-]+\.accounting-app-9f0\.pages\.dev$/.test(origin);
}

function corsHeaders(origin) {
  return isAllowedOrigin(origin)
    ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    }
    : {};
}

function dayString(date) {
  return date.toISOString().slice(0, 10);
}

/** 只接受最近 7 天到明天之间的日期（时区差 + 离线补发） */
function isAcceptableDay(day) {
  if (!DAY_PATTERN.test(day)) return false;
  const time = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(time)) return false;
  const now = Date.now();
  return time >= now - 8 * 86400000 && time <= now + 2 * 86400000;
}

async function handleCollect(request, env) {
  const origin = request.headers.get('Origin') || '';
  const headers = corsHeaders(origin);
  if (!isAllowedOrigin(origin)) return new Response(null, { status: 403 });

  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > MAX_BODY_BYTES) return new Response(null, { status: 413, headers });

  let payload;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 413, headers });
    payload = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400, headers });
  }

  const entries = Array.isArray(payload?.e) ? payload.e.slice(0, MAX_ENTRIES) : [];
  const merged = new Map();
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length !== 4) continue;
    const [day, name, dim, count] = entry;
    if (typeof day !== 'string' || !isAcceptableDay(day)) continue;
    if (typeof name !== 'string' || !Object.hasOwn(TELEMETRY_EVENTS, name)) continue;
    if (typeof dim !== 'string' || !TELEMETRY_DIM_PATTERN.test(dim)) continue;
    if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) continue;
    const key = `${day}\u0000${name}\u0000${dim}`;
    merged.set(key, Math.min(MAX_COUNT, (merged.get(key) || 0) + count));
  }

  if (merged.size > 0) {
    const statement = env.STATS.prepare(
      `INSERT INTO counters (day, name, dim, count) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (day, name, dim) DO UPDATE SET count = count + excluded.count`
    );
    const batch = [...merged.entries()].map(([key, count]) => {
      const [day, name, dim] = key.split('\u0000');
      return statement.bind(day, name, dim, count);
    });
    await env.STATS.batch(batch);
  }

  return new Response(null, { status: 204, headers });
}

// ── Cloudflare Access 令牌校验（RS256）──

const certCache = { keys: null, fetchedAt: 0 };

function base64UrlDecode(input) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function accessKeys(teamDomain) {
  if (certCache.keys && Date.now() - certCache.fetchedAt < 3600000) return certCache.keys;
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error('certs');
  const { keys } = await response.json();
  certCache.keys = keys;
  certCache.fetchedAt = Date.now();
  return keys;
}

function readCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.split(/;\s*/).find((part) => part.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}

async function verifyAccess(request, env) {
  const teamDomain = (env.ACCESS_TEAM_DOMAIN || '').trim();
  const audience = (env.ACCESS_AUD || '').trim();
  if (!teamDomain || !audience) return { ok: false, reason: 'not-configured' };

  const token = request.headers.get('Cf-Access-Jwt-Assertion') || readCookie(request, 'CF_Authorization');
  if (!token) return { ok: false, reason: 'no-token' };

  try {
    const [headerPart, payloadPart, signaturePart] = token.split('.');
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerPart)));
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadPart)));
    const keys = await accessKeys(teamDomain);
    const jwk = keys.find((key) => key.kid === header.kid);
    if (!jwk || header.alg !== 'RS256') return { ok: false, reason: 'bad-key' };

    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      base64UrlDecode(signaturePart),
      new TextEncoder().encode(`${headerPart}.${payloadPart}`)
    );
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const now = Math.floor(Date.now() / 1000);
    if (!valid) return { ok: false, reason: 'bad-signature' };
    if (!audiences.includes(audience)) return { ok: false, reason: 'bad-audience' };
    if (payload.iss !== `https://${teamDomain}`) return { ok: false, reason: 'bad-issuer' };
    if (typeof payload.exp !== 'number' || payload.exp < now) return { ok: false, reason: 'expired' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

const LOCKED_HTML = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>拾序 · 看板</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#16121a;color:#f5efe8;font:15px/1.7 system-ui,sans-serif;text-align:center;padding:24px">
<div><p style="font-size:20px;margin:0 0 8px">看板还没有打开</p><p style="opacity:.6;margin:0">需要先在 Cloudflare 里为 stats.yijian6.com 设置访问保护（Access），并登录。</p></div></body></html>`;

async function handleSummary(request, env) {
  const url = new URL(request.url);
  const days = Math.min(KEEP_DAYS, Math.max(7, Number(url.searchParams.get('days')) || 120));
  const since = dayString(new Date(Date.now() - days * 86400000));
  const { results } = await env.STATS.prepare(
    'SELECT day, name, dim, count FROM counters WHERE day >= ?1 ORDER BY day'
  ).bind(since).all();
  return Response.json(
    { since, days, rows: results || [], events: TELEMETRY_EVENTS },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/collect') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('Origin') || '') });
      }
      if (request.method === 'POST') return handleCollect(request, env);
      return new Response(null, { status: 405 });
    }

    if (request.method !== 'GET') return new Response(null, { status: 405 });

    // 看板和数据接口：必须带有效的 Access 登录令牌
    const access = await verifyAccess(request, env);
    if (!access.ok) {
      if (url.pathname.startsWith('/api/')) {
        return Response.json({ error: access.reason }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
      }
      return new Response(LOCKED_HTML, {
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    if (url.pathname === '/api/summary') return handleSummary(request, env);
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(DASHBOARD_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    return new Response('Not found', { status: 404 });
  },

  async scheduled(_event, env) {
    const cutoff = dayString(new Date(Date.now() - KEEP_DAYS * 86400000));
    await env.STATS.prepare('DELETE FROM counters WHERE day < ?1').bind(cutoff).run();
  },
};
