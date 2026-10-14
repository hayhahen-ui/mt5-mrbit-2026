/**
 * kaizenServer.ts — gọi API /api/kaizen (findings + knowledge), dùng chung cho các panel.
 * Server trước, null khi không có API → caller fallback local.
 */
import type { KaizenFinding } from './kaizenEngine';
import type { KnowledgeEntry } from './knowledge';

const API = (): string => {
  try {
    const u = (import.meta as any).env?.VITE_POSITIONS_API_URL || '';
    return u ? u.replace(/\/$/, '') : '';
  } catch { return ''; }
};

export const kaizenServerOn = (): boolean => !!API();

async function post(path: string, body: unknown): Promise<any | null> {
  const base = API();
  if (!base) return null;
  try {
    const r = await fetch(`${base}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    return d?.ok ? d : null;
  } catch { return null; }
}

async function patch(path: string, body: unknown): Promise<boolean> {
  const base = API();
  if (!base) return false;
  try {
    const r = await fetch(`${base}${path}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return (await r.json())?.ok === true;
  } catch { return false; }
}

export async function fetchKnowledgeServer(): Promise<KnowledgeEntry[] | null> {
  const base = API();
  if (!base) return null;
  try {
    const r = await fetch(`${base}/api/kaizen?type=knowledge`, { cache: 'no-store' });
    const d = await r.json();
    return d?.ok ? d.knowledge : null;
  } catch { return null; }
}

export async function postFindingServer(f: KaizenFinding): Promise<KaizenFinding | null> {
  const d = await post('/api/kaizen', { type: 'finding', ...f });
  return d?.finding ? { ...f, id: d.finding.id } : null;
}

export async function patchFindingServer(id: string, p: Partial<KaizenFinding>): Promise<boolean> {
  return patch('/api/kaizen', { type: 'finding', id, ...p });
}

export async function postKnowledgeServer(e: KnowledgeEntry): Promise<boolean> {
  return (await post('/api/kaizen', { type: 'knowledge', ...e })) !== null;
}

export async function patchKnowledgeServer(
  id: string, p: { active?: boolean; effect?: string; label?: string }
): Promise<boolean> {
  return patch('/api/kaizen', { type: 'knowledge', id, ...p });
}
