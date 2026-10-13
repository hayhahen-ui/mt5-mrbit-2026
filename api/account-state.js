/**
 * /api/account-state.js — Trình duyệt đẩy trạng thái tài khoản lên server định kỳ
 * (nấc 2). Agent đọc qua /api/agent-brief; lệnh agent bị từ chối nếu state quá cũ (>30').
 * POST {startBalance, realizedPnl, equity, floatingPnl, openCount, usedMargin}
 */
import { configured, cors, upd } from './_supa.js';

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
    const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
    const row = {
      start_balance: num(body.startBalance, 200),
      realized_pnl: num(body.realizedPnl),
      equity: num(body.equity, 200),
      floating_pnl: num(body.floatingPnl),
      open_count: Math.max(0, Math.round(num(body.openCount))),
      used_margin: Math.max(0, num(body.usedMargin)),
      updated_at: new Date().toISOString(),
    };
    if (!(row.equity > 0)) return res.status(400).json({ ok: false, error: 'equity phải > 0.' });
    const { q, ins } = await import('./_supa.js');
    const cur = await q('/account_state', { id: 'eq.1', select: 'id', limit: 1 });
    if (cur && cur[0]) await upd('/account_state', row, { id: 'eq.1' });
    else await ins('/account_state', [{ id: 1, ...row }]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ ok: false, error: `Lỗi account-state: ${String(e.message || e).slice(0, 200)}` });
  }
}
