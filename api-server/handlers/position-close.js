/**
 * /api/position-close.js — Đóng lệnh trên kho server (nấc 2).
 * POST {id, outcome?, exitPrice, note?, agent?, created_by?}
 * - outcome: TP | SL | BE | MANUAL | TIME (mặc định suy từ exitPrice nếu thiếu)
 * - Idempotent: lệnh đã closed → trả ok + already_closed (không ghi đè)
 * - Agent cần Bearer NAIVE_AGENT_KEY khi created_by=agent.
 */
import { configured, cors, agentAuth, q, upd, pnlUsd, logAction } from '../../api/_supa.js';

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
    const exitPrice = Number(body.exitPrice);
    if (!id) return res.status(400).json({ ok: false, error: 'Thiếu id.' });
    if (!(exitPrice > 0)) return res.status(400).json({ ok: false, error: 'exitPrice phải > 0.' });

    const rows = await q('/positions', { id: `eq.${id}`, select: '*', limit: 1 });
    const pos = rows && rows[0];
    if (!pos) return res.status(404).json({ ok: false, error: 'Không tìm thấy lệnh.' });
    if (pos.status === 'closed') {
      return res.status(200).json({ ok: true, already_closed: true, position: pos });
    }

    let outcome = String(body.outcome || '').toUpperCase();
    if (!['TP','SL','BE','MANUAL','TIME'].includes(outcome)) {
      const favorable = pos.type === 'BUY' ? exitPrice > Number(pos.entry_price) : exitPrice < Number(pos.entry_price);
      outcome = favorable ? 'MANUAL' : 'SL';
    }
    const pnl = pnlUsd({ symbol: pos.symbol, direction: pos.type, lot: Number(pos.lot), entryPrice: Number(pos.entry_price), exitPrice });
    const updated = await upd('/positions', {
      status: 'closed',
      closed_at: new Date().toISOString(),
      exit_price: exitPrice,
      outcome,
      close_note: String(body.note || '').slice(0, 200) || null,
    }, { id: `eq.${id}` });
    await logAction({ agent: agentName, action: 'close', position_id: id, params: { outcome, exitPrice }, result: `pnl $${pnl}` });
    return res.status(200).json({ ok: true, position: (updated && updated[0]) || null, pnlUsd: pnl });
  } catch (e) {
    return res.status(502).json({ ok: false, error: `Lỗi position-close: ${String(e.message || e).slice(0, 200)}` });
  }
}
