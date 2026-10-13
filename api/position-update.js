/**
 * /api/position-update.js — Cập nhật lệnh đang mở (dời SL về BE, sửa autoClose).
 * POST {id, sl?, autoClose?, note?, agent?, created_by?}
 * - Agent cần Bearer NAIVE_AGENT_KEY khi created_by=agent.
 */
import { configured, cors, agentAuth, q, upd, logAction } from './_supa.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!configured()) return res.status(503).json({ ok: false, error: 'Server chưa cấu hình Supabase.' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ ok: false, error: 'Body JSON không hợp lệ.' }); }
    }
    const createdBy = body.created_by === 'agent' ? 'agent' : 'browser';
    const agentName = String(body.agent || (createdBy === 'agent' ? 'naive-agent' : 'browser')).slice(0, 64);
    if (createdBy === 'agent' && !agentAuth(req)) {
      return res.status(401).json({ ok: false, error: 'Thiếu Bearer NAIVE_AGENT_KEY.' });
    }
    const id = String(body.id || '');
    if (!id) return res.status(400).json({ ok: false, error: 'Thiếu id.' });

    const rows = await q('/positions', { id: `eq.${id}`, select: '*', limit: 1 });
    const pos = rows && rows[0];
    if (!pos) return res.status(404).json({ ok: false, error: 'Không tìm thấy lệnh.' });
    if (pos.status !== 'open') return res.status(409).json({ ok: false, error: 'Lệnh đã đóng, không cập nhật được.' });

    const patch = {};
    if (body.sl !== undefined) {
      const sl = Number(body.sl);
      if (!(sl > 0)) return res.status(400).json({ ok: false, error: 'sl phải > 0.' });
      // SL mới không được tệ hơn SL cũ (chỉ dời về hướng có lợi / BE)
      const entry = Number(pos.entry_price);
      const oldSl = Number(pos.sl);
      const better = pos.type === 'BUY' ? sl >= oldSl && sl <= entry : sl <= oldSl && sl >= entry;
      if (!better) return res.status(400).json({ ok: false, error: 'SL mới phải tốt hơn hoặc bằng SL cũ (hướng về BE).' });
      patch.sl = sl;
    }
    if (body.autoClose !== undefined) {
      patch.auto_close = typeof body.autoClose === 'object' ? body.autoClose : {};
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ ok: false, error: 'Không có gì để cập nhật (sl / autoClose).' });
    }
    const updated = await upd('/positions', patch, { id: `eq.${id}` });
    await logAction({ agent: agentName, action: 'update', position_id: id, params: patch, result: 'ok' });
    return res.status(200).json({ ok: true, position: (updated && updated[0]) || null });
  } catch (e) {
    return res.status(502).json({ ok: false, error: `Lỗi position-update: ${String(e.message || e).slice(0, 200)}` });
  }
}
