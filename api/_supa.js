/**
 * api/_supa.js — Helper dùng chung cho API positions (nấc 2: Naive auto-operation).
 * File bắt đầu bằng _ nên Vercel KHÔNG route trực tiếp.
 *
 * Env cần (Vercel): SUPABASE_URL, SUPABASE_SERVICE_KEY, NAIVE_AGENT_KEY
 * Thiếu SUPABASE_* → mọi endpoint positions trả 503 "chưa cấu hình" (app chạy local-only).
 *
 * Công thức P&L/margin/pip là MIRROR của src/lib/account.ts + src/lib/positions.ts
 * (đã audit 27/27 pass ngày 13/10). Sửa công thức ở lib thì đồng bộ file này.
 */

export function env() {
  return {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_SERVICE_KEY || '',
    agentKey: process.env.NAIVE_AGENT_KEY || '',
  };
}

export function configured() {
  const { url, key } = env();
  return !!(url && key);
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/** Kiểm tra Bearer key của agent. Browser (created_by=browser) không cần key. */
export function agentAuth(req) {
  const { agentKey } = env();
  if (!agentKey) return false;
  const h = req.headers.authorization || '';
  return h === `Bearer ${agentKey}`;
}

async function rest(path, { method = 'GET', body, params } = {}) {
  const { url, key } = env();
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const r = await fetch(`${url}/rest/v1${path}${qs}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text().catch(() => '');
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* noop */ }
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${String(text).slice(0, 200)}`);
  return data;
}

export const q = (path, params) => rest(path, { method: 'GET', params });
export const ins = (path, body) => rest(path, { method: 'POST', body });
export const upd = (path, body, params) => rest(path, { method: 'PATCH', body, params });

// ── Công thức (mirror src/lib/account.ts, src/lib/positions.ts) ──
const LEVERAGE = 100;
const FOREX = ['EURUSD','GBPUSD','USDJPY','AUDUSD','NZDUSD','USDCAD','USDCHF','EURJPY','GBPJPY','EURGBP'];
export function pipSizeOf(symbol) {
  if (symbol.includes('JPY')) return 0.01;
  if (FOREX.includes(symbol)) return 0.0001;
  return 0.1;
}
export function usdPerPipPerLot(symbol, price) {
  if (symbol.includes('JPY')) return price && price > 0 ? 1000 / price : 6.3;
  if (FOREX.includes(symbol)) return 10;
  return 0.1;
}
export function pnlUsd({ symbol, direction, lot, entryPrice, exitPrice }) {
  const diff = direction === 'BUY' ? exitPrice - entryPrice : entryPrice - exitPrice;
  if (symbol === 'XAUUSD') return Number((diff * 100 * lot).toFixed(2));
  const pips = diff / pipSizeOf(symbol);
  return Number((pips * lot * usdPerPipPerLot(symbol, exitPrice)).toFixed(2));
}
export function marginOf({ symbol, lot, entryPrice }) {
  if (symbol === 'XAUUSD') return (lot * 100 * entryPrice) / LEVERAGE;
  if (symbol === 'BTCUSD' || symbol === 'ETHUSD') return (lot * entryPrice) / LEVERAGE;
  if (symbol === 'US30') return (lot * entryPrice) / LEVERAGE;
  if (symbol.startsWith('USD')) return (lot * 100000) / LEVERAGE;
  return (lot * 100000 * entryPrice) / LEVERAGE;
}

export function logAction({ agent, action, position_id, params, result }) {
  return ins('/agent_actions', [{ agent, action, position_id: position_id || null, params: params || null, result: String(result || '').slice(0, 500) }]).catch(() => null);
}
