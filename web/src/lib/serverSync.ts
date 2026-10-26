/**
 * serverSync.ts — Dual-write vị thế lên kho server (nấc 2: Naive auto-operation).
 *
 * - Mọi lệnh mở/đóng/sửa ở trình duyệt được đẩy lên /api/positions* (fire-and-forget).
 * - Nếu server chưa cấu hình Supabase (503) → im lặng, app chạy local-only như cũ.
 * - Id đã đẩy được lưu localStorage để không đẩy trùng sau F5.
 */
import { POSITIONS_API_URL } from './apiHealth';
import type { Position } from '../types';

/**
 * Base URL cho API positions nấc 2.
 * - Production: VITE_POSITIONS_API_URL → Render Web Service (mt5-mrbit-2026-api)
 * - Fallback: POSITIONS_API_URL (Render) khi chưa cấu hình — 26/10/2026: fallback
 *   cũ về API_BASE (Vercel) là sai vì Vercel không phục vụ /api/positions (404),
 *   khiến dual-write vị thế lặng lẽ rớt hết trong production.
 */
const POS_BASE = (import.meta as any).env?.VITE_POSITIONS_API_URL || POSITIONS_API_URL;
const posUrl = (path: string) => `${POS_BASE}${path}`;

const PUSHED_KEY = 'nexuspilot-synced-positions-v1';
const UNAVAIL_KEY = 'nexuspilot-server-unavail-until';

let availCache: boolean | null = null;

function getPushed(): Set<string> {
  try {
    const raw = localStorage.getItem(PUSHED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}
function markPushed(id: string) {
  try {
    const s = getPushed();
    s.add(id);
    // Giữ tối đa 500 id gần nhất
    const arr = [...s].slice(-500);
    localStorage.setItem(PUSHED_KEY, JSON.stringify(arr));
  } catch { /* noop */ }
}
function markUnavailable() {
  try {
    localStorage.setItem(UNAVAIL_KEY, String(Date.now() + 5 * 60 * 1000));
  } catch { /* noop */ }
}
function isMarkedUnavailable(): boolean {
  try {
    return Date.now() < Number(localStorage.getItem(UNAVAIL_KEY) || 0);
  } catch {
    return false;
  }
}

async function post(path: string, body: unknown): Promise<boolean> {
  if (availCache === false || isMarkedUnavailable()) return false;
  try {
    const r = await fetch(posUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (r.status === 503) {
      availCache = false;
      markUnavailable(); // server chưa cấu hình → đừng spam
      return false;
    }
    if (!r.ok) return false;
    if (availCache === null) availCache = true;
    return true;
  } catch {
    return false;
  }
}

/** Đẩy các vị thế mới mở lên server (bỏ qua những id đã đẩy). */
export function pushOpenedPositions(positions: Position[], deviceId: string): void {
  const pushed = getPushed();
  const fresh = positions.filter((p) => !pushed.has(p.id));
  if (fresh.length === 0) return;
  for (const p of fresh) {
    post('/api/positions', {
      id: p.id,
      symbol: p.symbol,
      type: p.type,
      lot: p.lot,
      entryPrice: p.entryPrice,
      sl: p.sl,
      tp: p.tp,
      tier: p.tier,
      autoClose: p.autoClose || {},
      deviceId,
      kaizenId: p.kaizenId || undefined,
      created_by: 'browser',
    }).then((ok) => { if (ok) markPushed(p.id); });
  }
}

/** Đẩy sự kiện đóng lệnh lên server. */
export function pushClosedPosition(id: string, outcome: string, exitPrice: number, note?: string): void {
  post('/api/position-close', { id, outcome, exitPrice, note: note || '', created_by: 'browser' })
    .then((ok) => { if (ok) markPushed(id); });
}

/** Đẩy cập nhật (dời SL/BE, sửa autoClose) lên server. */
export function pushUpdatedPosition(id: string, patch: { sl?: number; autoClose?: unknown }): void {
  post('/api/position-update', { id, ...patch, created_by: 'browser' });
}

/** Đẩy trạng thái tài khoản (để agent-brief có equity/margin tươi). */
export function pushAccountState(s: {
  startBalance: number; realizedPnl: number; equity: number;
  floatingPnl: number; openCount: number; usedMargin: number;
}): void {
  post('/api/account-state', s);
}

/** Kiểm tra server có sẵn không (dùng cho UI badge). */
export async function checkServerAvailable(): Promise<boolean> {
  if (availCache !== null) return availCache;
  if (isMarkedUnavailable()) return false;
  try {
    const r = await fetch(posUrl('/api/positions?status=open&limit=1'));
    if (r.status === 503) { availCache = false; markUnavailable(); return false; }
    availCache = r.ok;
    return r.ok;
  } catch {
    return false;
  }
}
