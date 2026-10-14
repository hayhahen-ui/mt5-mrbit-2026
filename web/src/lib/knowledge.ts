/**
 * knowledge.ts — Tầng 4 vòng Kaizen khép kín: KHO KIẾN THỨC.
 *
 * Finding đã kiểm chứng (hoặc user duyệt tay) → knowledge entry:
 * {luật, điều kiện áp dụng, độ tin cậy, cỡ mẫu, nhãn} — versioned, không xóa.
 *
 * Nhãn: FACT (đo được) / TINH_TOAN (suy ra từ số) / SUY_LUAN (giả thuyết) / CHUA_XAC_MINH.
 * Phase C (cổng RADAR) dùng matchRules() để lọc tín hiệu.
 * Logic thuần + store localStorage — test được.
 */

import type { KaizenFinding, FindingSeverity } from './kaizenEngine';

export type KnowledgeLabel = 'FACT' | 'TINH_TOAN' | 'SUY_LUAN' | 'CHUA_XAC_MINH';
export type Confidence = 'cao' | 'trung-binh' | 'thap';

export interface RuleCondition {
  field: string; // vd 'session' | 'symbol' | 'verdict' | 'newsHigh' | 'hour'
  op: 'eq' | 'neq' | 'in' | 'gte' | 'lte';
  value: string | number | boolean | (string | number)[];
}

export interface KnowledgeEntry {
  id: string;
  rule: string; // luật, vd "Không mở lệnh mới 19:00–20:00 ngày có CPI Mỹ"
  conditions: RuleCondition[]; // rỗng = áp dụng mọi trường hợp
  confidence: Confidence;
  sampleSize: number;
  label: KnowledgeLabel;
  source: string; // id finding hoặc 'thu-cong'
  createdAt: number;
  updatedAt: number;
  active: boolean; // false = hết hiệu lực (giữ lại lịch sử, không xóa)
}

const KEY = 'nexuspilot-knowledge-v1';

let seq = 0;
const nid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq += 1)}`;

/** Đánh giá 1 điều kiện trên context tín hiệu. Unknown field → false (an toàn: không áp bừa). */
export function evalCondition(c: RuleCondition, ctx: Record<string, unknown>): boolean {
  const v = ctx[c.field];
  if (v === undefined || v === null) return false;
  switch (c.op) {
    case 'eq':
      return v === c.value;
    case 'neq':
      return v !== c.value;
    case 'in':
      return Array.isArray(c.value) && (c.value as (string | number)[]).includes(v as string | number);
    case 'gte':
      return typeof v === 'number' && typeof c.value === 'number' && v >= c.value;
    case 'lte':
      return typeof v === 'number' && typeof c.value === 'number' && v <= c.value;
    default:
      return false;
  }
}

/** Entry có khớp toàn bộ điều kiện với context không (và đang active). */
export function entryMatches(e: KnowledgeEntry, ctx: Record<string, unknown>): boolean {
  if (!e.active) return false;
  return e.conditions.every((c) => evalCondition(c, ctx));
}

/** Lọc các luật áp dụng được cho context tín hiệu hiện tại (Phase C dùng). */
export function matchRules(ctx: Record<string, unknown>, entries: KnowledgeEntry[]): KnowledgeEntry[] {
  return entries.filter((e) => entryMatches(e, ctx));
}

/** Thăng finding thành knowledge entry. Mặc định nhãn SUY_LUAN — chỉ FACT khi có bằng chứng đo trực tiếp. */
export function promoteFinding(
  f: KaizenFinding,
  opts?: { rule?: string; conditions?: RuleCondition[]; confidence?: Confidence; label?: KnowledgeLabel }
): KnowledgeEntry {
  const now = Date.now();
  const conf: Confidence =
    opts?.confidence || (f.severity === 'cao' && f.sampleSize >= 30 ? 'cao' : f.severity === 'cao' ? 'trung-binh' : 'thap');
  return {
    id: nid('KN'),
    rule: opts?.rule || f.action,
    conditions: opts?.conditions || [],
    confidence: conf,
    sampleSize: f.sampleSize,
    label: opts?.label || 'SUY_LUAN',
    source: f.id,
    createdAt: now,
    updatedAt: now,
    active: true,
  };
}

/* ---------- store localStorage ---------- */

export function loadKnowledge(): KnowledgeEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveKnowledge(list: KnowledgeEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* kho đầy — giữ nguyên dữ liệu cũ */
  }
}

export function addKnowledge(e: KnowledgeEntry): KnowledgeEntry[] {
  const list = loadKnowledge();
  list.push(e);
  saveKnowledge(list);
  return list;
}

/** Không xóa — chỉ đánh dấu hết hiệu lực, giữ lịch sử. */
export function deactivateKnowledge(id: string): KnowledgeEntry[] {
  const list = loadKnowledge().map((e) =>
    e.id === id ? { ...e, active: false, updatedAt: Date.now() } : e
  );
  saveKnowledge(list);
  return list;
}

export function reactivateKnowledge(id: string): KnowledgeEntry[] {
  const list = loadKnowledge().map((e) =>
    e.id === id ? { ...e, active: true, updatedAt: Date.now() } : e
  );
  saveKnowledge(list);
  return list;
}

/* ---------- seed: luật đã được user chốt trước đây ---------- */

function seedIfEmpty(): void {
  if (loadKnowledge().length > 0) return;
  const now = Date.now();
  const seed: KnowledgeEntry[] = [
    {
      id: nid('KN'),
      rule: 'Không mở lệnh mới quanh tin HIGH (đề xuất chờ duyệt)',
      conditions: [{ field: 'newsHigh', op: 'eq', value: true }],
      confidence: 'trung-binh',
      sampleSize: 0,
      label: 'CHUA_XAC_MINH',
      source: 'de-xuat-14-10-2026',
      createdAt: now,
      updatedAt: now,
      active: false, // CHƯA được user chốt → inactive
    },
  ];
  saveKnowledge(seed);
}

try {
  seedIfEmpty();
} catch {
  /* SSR / test không có localStorage */
}
