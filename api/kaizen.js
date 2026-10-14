/**
 * /api/kaizen.js — Kho FINDING Kaizen + KHO KIẾN THỨC (vòng Kaizen khép kín, Phase A).
 *
 * GET    ?type=findings|knowledge → liệt kê (mới nhất trước)
 * POST   {type:'finding', area, metric, title, evidence, hypothesis, action, severity, kind?, sampleSize?}
 * POST   {type:'knowledge', rule, conditions?, confidence?, sampleSize?, label?, source?}
 * PATCH  {type:'finding'|'knowledge', id, status?|active?} → cập nhật trạng thái
 * DELETE ?type=finding|knowledge&id= → xóa
 *
 * Ghi theo pattern browser của benchmarks API (không cần key).
 * Nếu bảng chưa migrate (003_kaizen.sql) → 503 kèm hướng dẫn.
 */
import { configured, cors, env, q, ins } from './_supa.js';

const TABLE_MISSING = /kaizen_findings|knowledge_entries|relation .* does not exist/i;

const SEV = ['cao', 'trung-binh', 'thap'];
const KIND = ['luat-cung', 'de-xuat'];
const STATUS = ['moi', 'dang-theo-doi', 'da-kiem-chung', 'da-bac-bo'];
const CONF = ['cao', 'trung-binh', 'thap'];
const LABEL = ['FACT', 'TINH_TOAN', 'SUY_LUAN', 'CHUA_XAC_MINH'];

const pick = (v, list, dflt) => (list.includes(v) ? v : dflt);
const genId = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const toFinding = (r) => ({
  id: r.id, area: r.area, metric: r.metric, title: r.title,
  evidence: r.evidence, hypothesis: r.hypothesis, action: r.action,
  severity: r.severity, kind: r.kind, status: r.status,
  sampleSize: Number(r.sample_size) || 0, createdAt: new Date(r.created_at).getTime(),
});
const toKnowledge = (r) => ({
  id: r.id, rule: r.rule, conditions: r.conditions || [],
  confidence: r.confidence, sampleSize: Number(r.sample_size) || 0,
  label: r.label, source: r.source || '', active: !!r.active,
  createdAt: new Date(r.created_at).getTime(), updatedAt: new Date(r.updated_at).getTime(),
});

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!configured()) return res.status(503).json({ ok: false, error: 'Server chưa cấu hình Supabase. App chạy local-only.' });

  try {
    if (req.method === 'GET') {
      const type = req.query.type === 'knowledge' ? 'knowledge' : 'findings';
      if (type === 'knowledge') {
        const rows = await q('/knowledge_entries', { order: 'updated_at.desc', limit: '200' });
        return res.status(200).json({ ok: true, knowledge: rows.map(toKnowledge) });
      }
      const rows = await q('/kaizen_findings', { order: 'created_at.desc', limit: '200' });
      return res.status(200).json({ ok: true, findings: rows.map(toFinding) });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { return res.status(400).json({ ok: false, error: 'Body JSON không hợp lệ.' }); }
      }
      if (body.type === 'knowledge') {
        const row = {
          id: genId('KN'),
          rule: String(body.rule || '').slice(0, 500),
          conditions: Array.isArray(body.conditions) ? body.conditions : [],
          confidence: pick(body.confidence, CONF, 'thap'),
          sample_size: Math.max(0, Number(body.sampleSize) || 0),
          label: pick(body.label, LABEL, 'SUY_LUAN'),
          source: String(body.source || '').slice(0, 120),
          active: body.active !== false,
        };
        if (!row.rule) return res.status(400).json({ ok: false, error: 'Thiếu rule.' });
        const created = await ins('/knowledge_entries', [row]);
        return res.status(200).json({ ok: true, knowledge: toKnowledge(created[0]) });
      }
      // finding
      const row = {
        id: genId('KF'),
        area: String(body.area || 'symbol').slice(0, 30),
        metric: String(body.metric || '').slice(0, 40),
        title: String(body.title || '').slice(0, 200),
        evidence: String(body.evidence || '').slice(0, 2000),
        hypothesis: String(body.hypothesis || '').slice(0, 2000),
        action: String(body.action || '').slice(0, 2000),
        severity: pick(body.severity, SEV, 'trung-binh'),
        kind: pick(body.kind, KIND, 'de-xuat'),
        status: 'moi',
        sample_size: Math.max(0, Number(body.sampleSize) || 0),
      };
      if (!row.title || !row.evidence) return res.status(400).json({ ok: false, error: 'Thiếu title/evidence.' });
      const created = await ins('/kaizen_findings', [row]);
      return res.status(200).json({ ok: true, finding: toFinding(created[0]) });
    }

    if (req.method === 'PATCH') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { return res.status(400).json({ ok: false, error: 'Body JSON không hợp lệ.' }); }
      }
      const id = String(body.id || '');
      if (!id) return res.status(400).json({ ok: false, error: 'Thiếu id.' });
      const { url, key } = env();
      if (body.type === 'knowledge') {
        const patch = { updated_at: new Date().toISOString() };
        if (typeof body.active === 'boolean') patch.active = body.active;
        if (body.label && LABEL.includes(body.label)) patch.label = body.label;
        const r = await fetch(`${url}/rest/v1/knowledge_entries?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!r.ok) throw new Error(`Supabase ${r.status}`);
        return res.status(200).json({ ok: true, id });
      }
      const patch = {};
      if (body.status && STATUS.includes(body.status)) patch.status = body.status;
      if (body.kind && KIND.includes(body.kind)) patch.kind = body.kind;
      const r = await fetch(`${url}/rest/v1/kaizen_findings?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error(`Supabase ${r.status}`);
      return res.status(200).json({ ok: true, id });
    }

    if (req.method === 'DELETE') {
      const type = req.query.type === 'knowledge' ? 'knowledge_entries' : 'kaizen_findings';
      const id = String(req.query.id || '');
      if (!id) return res.status(400).json({ ok: false, error: 'Thiếu ?id=' });
      const { url, key } = env();
      const r = await fetch(`${url}/rest/v1/${type}?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (!r.ok) throw new Error(`Supabase ${r.status}`);
      return res.status(200).json({ ok: true, deleted: id });
    }

    return res.status(405).json({ ok: false, error: 'GET/POST/PATCH/DELETE only' });
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (TABLE_MISSING.test(msg)) {
      return res.status(503).json({ ok: false, error: 'Chưa chạy migration 003_kaizen.sql trên Supabase (SQL Editor).' });
    }
    return res.status(502).json({ ok: false, error: `Lỗi kaizen API: ${msg.slice(0, 200)}` });
  }
}
