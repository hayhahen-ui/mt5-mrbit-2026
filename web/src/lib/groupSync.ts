/**
 * shared/groupSync.ts — Đồng bộ journal đa thiết bị qua link chia sẻ.
 *
 * - Chủ tạo nhóm: sinh GROUP_ID → link `?g=GROUP_ID` gửi cho thiết bị khác.
 * - Thiết bị khách mở link → tự join nhóm, mọi giao dịch được tag group+deviceId,
 *   tự đẩy lên kho chung qua /api/shared (không cần PAT).
 * - Chủ xem: kéo toàn bộ log của nhóm về, thấy giao dịch từng thiết bị.
 */
import { readApiJson } from './apiHealth';

const GROUP_LS = 'nexuspilot-share-group';   // nhóm đang tham gia (hoặc chủ)
const DEVICE_LS = 'nexuspilot-device-id';
const DEVICE_NAME_LS = 'nexuspilot-device-name';
const PUSHED_LS = 'nexuspilot-shared-pushed'; // ts cuối đã đẩy (chống trùng)

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_LS);
    if (!id) {
      id = 'dev-' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(DEVICE_LS, id);
    }
    return id;
  } catch { return 'dev-unknown'; }
}

export function getDeviceName(): string {
  try { return localStorage.getItem(DEVICE_NAME_LS) || ''; } catch { return ''; }
}
export function setDeviceName(n: string): void {
  try { localStorage.setItem(DEVICE_NAME_LS, n.slice(0, 64)); } catch { /* noop */ }
}

/** Group từ URL (?g=) hoặc đã lưu. */
export function getGroupId(): string | null {
  try {
    const url = new URL(window.location.href);
    const g = (url.searchParams.get('g') || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
    if (g.length >= 4) {
      localStorage.setItem(GROUP_LS, g);
      return g;
    }
    return localStorage.getItem(GROUP_LS);
  } catch { return null; }
}

export function setGroupId(g: string | null): void {
  try {
    if (g) localStorage.setItem(GROUP_LS, g.toUpperCase());
    else localStorage.removeItem(GROUP_LS);
  } catch { /* noop */ }
}

/** Chủ tạo nhóm mới. */
export function createGroup(): string {
  const g = 'NX-' + Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
  setGroupId(g);
  return g;
}

export function shareLink(group: string): string {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('g', group);
  return url.toString();
}

export interface SharedEntry {
  ts: number;
  type: string;
  symbol: string;
  direction: string;
  entry?: number | null;
  exit?: number | null;
  lot?: number | null;
  pnl?: number | null;
  pnlUsd?: number | null;
  rMultiple?: number | null;
  outcome?: string;
  note?: string;
  deviceId?: string;
  deviceName?: string;
}

/** Đẩy entries lên kho chung. */
export async function pushShared(entries: SharedEntry[]): Promise<number> {
  const group = getGroupId();
  if (!group || entries.length === 0) return 0;
  const r = await fetch('/api/shared', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      group,
      deviceId: getDeviceId(),
      deviceName: getDeviceName() || getDeviceId(),
      entries: entries.slice(0, 200),
    }),
  });
  const d = await readApiJson(r, 'Shared');
  if (d.error) throw new Error(d.error);
  return d.pushed || 0;
}

/** Kéo toàn bộ log của nhóm (chủ xem). */
export async function pullShared(group?: string): Promise<{ entries: SharedEntry[]; devices: any[] }> {
  const g = (group || getGroupId() || '').toUpperCase();
  if (!g) throw new Error('Chưa có group ID.');
  const r = await fetch(`/api/shared?group=${encodeURIComponent(g)}&t=${Date.now()}`, { cache: 'no-store' });
  const d = await readApiJson(r, 'Shared');
  if (d.error) throw new Error(d.error);
  return { entries: d.entries || [], devices: d.devices || [] };
}

/** Lấy các journal entries chưa đẩy (dựa vào ts). */
export function markPushed(ts: number): void {
  try { localStorage.setItem(PUSHED_LS, String(ts)); } catch { /* noop */ }
}
export function lastPushedTs(): number {
  try { return Number(localStorage.getItem(PUSHED_LS) || 0); } catch { return 0; }
}
