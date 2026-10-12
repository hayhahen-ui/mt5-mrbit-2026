/**
 * research/fredStore.ts — Kho FRED ONLINE trên nhánh `data` GitHub.
 *
 * Vấn đề: FRED key + cache trong localStorage chỉ nằm trên 1 trình duyệt.
 * Dùng điện thoại/máy khác → mất mapping dữ liệu.
 *
 * Giải pháp:
 * - Khi app (bất kỳ máy nào có FRED key) lấy được dữ liệu tươi → đẩy snapshot
 *   lên `research/fred/latest.json` + `research/fred/history/YYYY-MM-DD.json` (nhánh data).
 * - Mọi thiết bị đọc `latest.json` qua raw.githubusercontent.com (không cần PAT/key).
 * - Thứ tự ưu tiên đọc: GitHub online → API trực tiếp (nếu có key) → localStorage.
 * - GitHub Action chạy hàng ngày (xem .github/workflows/fred-daily.yml) để kho
 *   luôn tươi ngay cả khi user không mở app.
 */
import { FredSeries, FredSeriesId } from './fred';
import { getGhPat } from '../ghSync';

const REPO = 'hayhahen-ui/mt5-mrbit-2026';
const BRANCH = 'data';
const LATEST_PATH = 'research/fred/latest.json';

export interface FredSnapshot {
  asOf: string; // YYYY-MM-DD
  fetchedAt: string; // ISO
  source: 'github-action' | 'app-push';
  series: Record<FredSeriesId, { date: string; value: number | null; prevDate?: string; prevValue?: number | null }>;
}

function dayStr(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

async function gh(path: string, pat: string, init?: RequestInit): Promise<any> {
  const r = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${pat}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers || {}),
    },
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`GitHub ${r.status}: ${t.slice(0, 120)}`);
  }
  return r.json();
}

const b64encode = (s: string) => btoa(unescape(encodeURIComponent(s)));
const b64decode = (s: string) => decodeURIComponent(escape(atob(s.replace(/\n/g, ''))));

/** Đọc snapshot mới nhất từ GitHub (không cần PAT — repo public). */
export async function fetchFredSnapshotOnline(): Promise<{ snap: FredSnapshot; ageH: number } | null> {
  try {
    // cache-bust để luôn lấy bản mới nhất
    const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${LATEST_PATH}?t=${Date.now()}`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    const snap = (await r.json()) as FredSnapshot;
    if (!snap?.series || !snap?.fetchedAt) return null;
    const ageH = (Date.now() - new Date(snap.fetchedAt).getTime()) / 3600000;
    return { snap, ageH };
  } catch {
    return null;
  }
}

/** Đẩy snapshot lên nhánh data (cần PAT — dùng chung với GhSync). */
export async function pushFredSnapshot(
  series: Record<FredSeriesId, FredSeries>,
  source: FredSnapshot['source'] = 'app-push'
): Promise<boolean> {
  const pat = getGhPat();
  if (!pat) return false;
  const day = dayStr();
  const snap: FredSnapshot = {
    asOf: day,
    fetchedAt: new Date().toISOString(),
    source,
    series: {} as FredSnapshot['series'],
  };
  for (const id of Object.keys(series) as FredSeriesId[]) {
    const s = series[id];
    snap.series[id] = {
      date: s.latest?.date || '',
      value: s.latest?.value ?? null,
      prevDate: s.previous?.date,
      prevValue: s.previous?.value ?? null,
    };
  }
  // Chỉ đẩy khi có ít nhất 3/5 chuỗi có dữ liệu
  const okCount = Object.values(snap.series).filter((v) => v.value !== null).length;
  if (okCount < 3) return false;

  const content = b64encode(JSON.stringify(snap, null, 1));
  const paths = [LATEST_PATH, `research/fred/history/${day}.json`];
  try {
    for (const path of paths) {
      let sha: string | undefined;
      try {
        const cur = await gh(`/repos/${REPO}/contents/${path}?ref=${BRANCH}`, pat);
        sha = cur.sha;
        // latest.json: ghi đè luôn; history: bỏ qua nếu đã có (tránh ghi đè lịch sử)
        if (path !== LATEST_PATH && sha) continue;
      } catch (e: any) {
        if (!String(e.message || '').includes('404')) throw e;
      }
      await gh(`/repos/${REPO}/contents/${path}`, pat, {
        method: 'PUT',
        body: JSON.stringify({
          message: `fred snapshot ${day} (${source})`,
          content,
          branch: BRANCH,
          ...(sha ? { sha } : {}),
        }),
      });
    }
    try { localStorage.setItem('nexuspilot-fred-pushed-at', new Date().toISOString()); } catch { /* noop */ }
    return true;
  } catch {
    return false;
  }
}

/** Lần đẩy gần nhất (để tránh đẩy liên tục). */
export function lastFredPushAt(): number {
  try {
    const v = localStorage.getItem('nexuspilot-fred-pushed-at');
    return v ? new Date(v).getTime() : 0;
  } catch { return 0; }
}

/** Chuyển snapshot online → định dạng FredSeries để dùng chung với directionScore. */
export function snapshotToSeries(snap: FredSnapshot): Record<FredSeriesId, FredSeries> {
  const out = {} as Record<FredSeriesId, FredSeries>;
  for (const id of Object.keys(snap.series) as FredSeriesId[]) {
    const v = snap.series[id];
    const change = v.value !== null && v.prevValue != null ? v.value - v.prevValue : null;
    out[id] = {
      id,
      latest: v.value !== null ? { date: v.date, value: v.value } : null,
      previous: v.prevValue != null ? { date: v.prevDate || '', value: v.prevValue } : null,
      change,
      changePct: change !== null && v.prevValue ? (change / Math.abs(v.prevValue)) * 100 : null,
      points: [],
      fetchedAt: new Date(snap.fetchedAt).getTime(),
    };
  }
  return out;
}
