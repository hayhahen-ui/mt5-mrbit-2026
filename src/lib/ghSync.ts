/**
 * ghSync.ts — Đồng bộ masterdata lên GitHub (nhánh `data`) để dữ liệu
 * luôn sẵn có trong hệ thống, kể cả khi xóa local hay đổi máy.
 * - Ghi: snapshot journal → forex/YYYY-MM-DD.jsonl (append qua Contents API).
 * - PAT fine-grained của user lưu localStorage (như Trade.2026), quyền Contents: read+write
 *   trên repo hayhahen-ui/mt5-mrbit-2026.
 * - Nhánh `data` tách khỏi `main` để không trigger Vercel rebuild.
 */
import { getForexJournal, ForexSnap } from './forexJournal';

const REPO = 'hayhahen-ui/mt5-mrbit-2026';
const BRANCH = 'data';
const PAT_KEY = 'nexuspilot-gh-pat-v1';
const SYNC_KEY = 'nexuspilot-gh-sync-v1';
const AUTO_KEY = 'nexuspilot-gh-autosync-v1';

export function getGhPat(): string {
  try { return localStorage.getItem(PAT_KEY) || ''; } catch { return ''; }
}
export function setGhPat(p: string) {
  try { p ? localStorage.setItem(PAT_KEY, p.trim()) : localStorage.removeItem(PAT_KEY); } catch { /* noop */ }
}
export function ghPatHint(): string {
  const p = getGhPat();
  return p ? `••••${p.slice(-4)}` : '';
}
export function ghAutoSync(): boolean {
  try { return localStorage.getItem(AUTO_KEY) === '1'; } catch { return false; }
}
export function setGhAutoSync(v: boolean) {
  try { localStorage.setItem(AUTO_KEY, v ? '1' : '0'); } catch { /* noop */ }
}

interface SyncState { lastAt: number; lastOk: string; pushed: number }
function getSyncState(): SyncState {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* noop */ }
  return { lastAt: 0, lastOk: '', pushed: 0 };
}
function setSyncState(s: SyncState) {
  try { localStorage.setItem(SYNC_KEY, JSON.stringify(s)); } catch { /* noop */ }
}
export function ghSyncStatus(): SyncState { return getSyncState(); }

async function gh(path: string, pat: string, init?: RequestInit): Promise<any> {
  const r = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`GitHub ${r.status}: ${t.slice(0, 160) || r.statusText}`);
  }
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

const b64encode = (s: string) =>
  btoa(unescape(encodeURIComponent(s)));
const b64decode = (s: string) =>
  decodeURIComponent(escape(atob(s.replace(/\n/g, ''))));

/** Đảm bảo nhánh `data` tồn tại (tạo từ main nếu chưa có). */
async function ensureDataBranch(pat: string): Promise<void> {
  try {
    await gh(`/repos/${REPO}/git/ref/heads/${BRANCH}`, pat);
    return; // đã có
  } catch { /* chưa có → tạo */ }
  const main = await gh(`/repos/${REPO}/git/ref/heads/main`, pat);
  const sha = main?.object?.sha;
  if (!sha) throw new Error('Không lấy được SHA của main.');
  await gh(`/repos/${REPO}/git/refs`, pat, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha }),
  });
}

function dayPath(at: number): string {
  const d = new Date(at);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `forex/${ymd}.jsonl`;
}

/**
 * Đẩy các snapshot mới (at > lastAt) lên nhánh data.
 * Trả về số snapshot đã đẩy.
 */
export async function ghSyncNow(): Promise<{ pushed: number; path: string }> {
  const pat = getGhPat();
  if (!pat) throw new Error('Chưa nhập GitHub PAT.');
  await ensureDataBranch(pat);
  const st = getSyncState();
  const fresh = getForexJournal().filter((s) => s.at > st.lastAt);
  if (fresh.length === 0) return { pushed: 0, path: '' };

  // Gom theo ngày (thường chỉ 1 file)
  const byDay = new Map<string, ForexSnap[]>();
  for (const s of fresh) {
    const p = dayPath(s.at);
    if (!byDay.has(p)) byDay.set(p, []);
    byDay.get(p)!.push(s);
  }

  let lastPath = '';
  for (const [path, snaps] of byDay) {
    const lines = snaps.map((s) => JSON.stringify(s)).join('\n') + '\n';
    let sha: string | undefined;
    let existing = '';
    try {
      const cur = await gh(`/repos/${REPO}/contents/${path}?ref=${BRANCH}`, pat);
      sha = cur.sha;
      existing = b64decode(cur.content || '');
      if (existing && !existing.endsWith('\n')) existing += '\n';
    } catch (e: any) {
      if (!String(e.message || '').includes('404')) throw e; // file chưa có → tạo mới
    }
    // Chống trùng: bỏ snapshot đã có trong file (so at)
    const have = new Set(
      existing.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l).at; } catch { return -1; } })
    );
    const newLines = snaps.filter((s) => !have.has(s.at)).map((s) => JSON.stringify(s)).join('\n');
    if (!newLines) continue;
    const content = b64encode(existing + newLines + '\n');
    await gh(`/repos/${REPO}/contents/${path}`, pat, {
      method: 'PUT',
      body: JSON.stringify({
        message: `masterdata forex ${path} (+${snaps.length} snapshots)`,
        content,
        branch: BRANCH,
        ...(sha ? { sha } : {}),
      }),
    });
    lastPath = path;
  }

  const maxAt = Math.max(...fresh.map((s) => s.at));
  const nst: SyncState = {
    lastAt: maxAt,
    lastOk: new Date().toISOString(),
    pushed: st.pushed + fresh.length,
  };
  setSyncState(nst);
  return { pushed: fresh.length, path: lastPath };
}

/** Liệt kê file masterdata trên nhánh data (để hiển thị dung lượng). */
export async function ghRemoteIndex(): Promise<{ path: string; size: number }[]> {
  const pat = getGhPat();
  if (!pat) throw new Error('Chưa nhập GitHub PAT.');
  await ensureDataBranch(pat);
  try {
    const tree = await gh(`/repos/${REPO}/git/trees/heads/${BRANCH}?recursive=1`, pat);
    const items = (tree?.tree || []).filter((t: any) => t.path?.startsWith('forex/') && t.path?.endsWith('.jsonl'));
    return items.map((t: any) => ({ path: t.path, size: t.size || 0 }));
  } catch (e: any) {
    if (String(e.message || '').includes('404')) return [];
    throw e;
  }
}

export function ghRemoteSizeCache(): { at: number; bytes: number; files: number } | null {
  try {
    const raw = localStorage.getItem('nexuspilot-gh-remote-v1');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export async function ghRefreshRemoteSize(): Promise<{ bytes: number; files: number }> {
  const idx = await ghRemoteIndex();
  const bytes = idx.reduce((a, f) => a + f.size, 0);
  try {
    localStorage.setItem('nexuspilot-gh-remote-v1', JSON.stringify({ at: Date.now(), bytes, files: idx.length }));
  } catch { /* noop */ }
  return { bytes, files: idx.length };
}

/** % bộ nhớ localStorage đã dùng (ước tính trên trần 5MB). */
export function localStorageUsage(): { bytes: number; pct: number } {
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const v = localStorage.getItem(k) || '';
      bytes += (k.length + v.length) * 2;
    }
  } catch { /* noop */ }
  const CAP = 5 * 1024 * 1024;
  return { bytes, pct: Math.min(100, (bytes / CAP) * 100) };
}
