/**
 * sentiment.ts — Tâm lý đám đông từ MyFxBook Community Outlook.
 * - Credential (email/password) lưu localStorage TRÊN MÁY USER (như AI key).
 * - Cache 15 phút (giới hạn tài khoản MyFxBook free).
 */
import {readApiJson, apiUrl} from './apiHealth';
const CRED_KEY = 'nexuspilot-mf-cred-v1';
const CACHE_KEY = 'nexuspilot-mf-outlook-v1';
const CACHE_MS = 15 * 60 * 1000;

export interface SentimentRow {
  symbol: string;
  longPct: number;
  shortPct: number;
  longPositions: number;
  shortPositions: number;
  totalPositions: number;
}

interface MfCred { email: string; password: string }

export function getMfCred(): MfCred | null {
  try {
    const raw = localStorage.getItem(CRED_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (typeof o.email === 'string' && typeof o.password === 'string' && o.email) return o;
    return null;
  } catch { return null; }
}

export function saveMfCred(email: string, password: string): void {
  try {
    localStorage.setItem(CRED_KEY, JSON.stringify({ email: email.trim(), password }));
  } catch { /* bỏ qua */ }
}

export function removeMfCred(): void {
  try {
    localStorage.removeItem(CRED_KEY);
    localStorage.removeItem(CACHE_KEY);
  } catch { /* bỏ qua */ }
}

export function mfEmailHint(): string | null {
  const c = getMfCred();
  if (!c) return null;
  const [user, domain] = c.email.split('@');
  if (!domain) return '••••';
  return `${user.slice(0, 2)}••••@${domain}`;
}

interface Cache { at: number; symbols: SentimentRow[] }

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Cache;
    if (!o || !Array.isArray(o.symbols)) return null;
    return o;
  } catch { return null; }
}

/** Đọc cache outlook đang có (không gọi mạng) — dùng cho nhật ký forex. */
export function getCachedOutlook(): SentimentRow[] {
  const c = readCache();
  if (!c || Date.now() - c.at > CACHE_MS) return [];
  return c.symbols;
}

/** Lấy outlook (dùng cache nếu còn tươi). force=true để bỏ qua cache. */
export async function getOutlook(force = false): Promise<{ symbols: SentimentRow[]; cached: boolean; error?: string }> {
  const cred = getMfCred();
  if (!cred) return { symbols: [], cached: false, error: 'Chưa nhập tài khoản MyFxBook (HELP → TÂM LÝ THỊ TRƯỜNG).' };
  const cache = readCache();
  if (!force && cache && Date.now() - cache.at < CACHE_MS) {
    return { symbols: cache.symbols, cached: true };
  }
  try {
    const r = await fetch(apiUrl('/api/myfxbook-outlook'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cred.email, password: cred.password }),
    });
    const d = await readApiJson(r, 'MyFxBook');
    if (!d.ok) return { symbols: cache?.symbols || [], cached: true, error: d.error || 'Lỗi MyFxBook.' };
    const symbols = (d.symbols || []) as SentimentRow[];
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), symbols })); } catch { /* noop */ }
    return { symbols, cached: false };
  } catch (e) {
    return { symbols: cache?.symbols || [], cached: true, error: e instanceof Error ? e.message : 'Lỗi mạng.' };
  }
}

/** Tìm sentiment cho 1 mã (EURUSD, GBPUSD, USDJPY, XAUUSD...) */
export function findSentiment(symbols: SentimentRow[], assetSymbol: string): SentimentRow | null {
  const key = assetSymbol.replace('#', '').toUpperCase();
  return symbols.find((s) => s.symbol === key) || null;
}

/** Diễn giải nhanh: đám đông nghiêng hẳn một chiều = tín hiệu contrarian */
export function sentimentBias(row: SentimentRow | null): string {
  if (!row) return '—';
  const d = row.longPct - row.shortPct;
  if (d >= 30) return `Đám đông LONG mạnh (${row.longPct}%) — cẩn trọng đảo chiều`;
  if (d <= -30) return `Đám đông SHORT mạnh (${row.shortPct}%) — cẩn trọng đảo chiều`;
  if (d >= 10) return `Nghiêng LONG (${row.longPct}%)`;
  if (d <= -10) return `Nghiêng SHORT (${row.shortPct}%)`;
  return `Cân bằng (${row.longPct}/${row.shortPct})`;
}
