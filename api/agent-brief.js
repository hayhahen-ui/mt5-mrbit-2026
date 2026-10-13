/**
 * /api/agent-brief.js — Gói JSON gọn cho Naive agent đọc trước mọi quyết định (nấc 2).
 * GET → { account, openPositions, todayClosed, halted, limits }
 * Cần Bearer NAIVE_AGENT_KEY.
 */
import { configured, cors, agentAuth, q, pnlUsd, marginOf, logAction } from './_supa.js';

function vnDayStartISO() {
  // 00:00 hôm nay theo giờ VN → ISO UTC
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });
  const [y, m, d] = fmt.format(new Date()).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 7 * 3600 * 1000).toISOString();
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!configured()) return res.status(503).json({ ok: false, error: 'Server chưa cấu hình Supabase.' });
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });
  if (!agentAuth(req)) return res.status(401).json({ ok: false, error: 'Thiếu Bearer NAIVE_AGENT_KEY.' });

  try {
    const [stateRows, openRows, closedRows, haltRows] = await Promise.all([
      q('/account_state', { id: 'eq.1', select: '*', limit: 1 }),
      q('/positions', { status: 'eq.open', select: '*', order: 'opened_at.desc', limit: 50 }),
      q('/positions', { status: 'eq.closed', closed_at: `gte.${vnDayStartISO()}`, select: 'id,symbol,type,lot,entry_price,exit_price,outcome,closed_at,created_by', order: 'closed_at.desc', limit: 100 }),
      q('/flags', { key: 'eq.halt_agent_trading_until', select: 'value', limit: 1 }),
    ]);

    const st = (stateRows && stateRows[0]) || null;
    const stateAgeMs = st ? Date.now() - new Date(st.updated_at).getTime() : Infinity;
    const openPositions = (openRows || []).map((p) => ({
      id: p.id, symbol: p.symbol, type: p.type, lot: Number(p.lot),
      entryPrice: Number(p.entry_price), sl: Number(p.sl), tp: Number(p.tp),
      tier: p.tier, openedAt: p.opened_at, createdBy: p.created_by,
      margin: Number(marginOf({ symbol: p.symbol, lot: Number(p.lot), entryPrice: Number(p.entry_price) }).toFixed(2)),
      autoClose: p.auto_close || {},
    }));
    const todayClosed = (closedRows || []).map((p) => ({
      id: p.id, symbol: p.symbol, type: p.type, outcome: p.outcome, createdBy: p.created_by,
      pnlUsd: pnlUsd({ symbol: p.symbol, direction: p.type, lot: Number(p.lot), entryPrice: Number(p.entry_price), exitPrice: Number(p.exit_price) }),
    }));
    const realizedToday = Number(todayClosed.reduce((a, c) => a + c.pnlUsd, 0).toFixed(2));
    const haltUntil = haltRows && haltRows[0] ? haltRows[0].value : null;
    const halted = !!(haltUntil && new Date(haltUntil).getTime() > Date.now());

    await logAction({ agent: 'naive-agent', action: 'brief', result: `open=${openPositions.length} realizedToday=${realizedToday}` });
    return res.status(200).json({
      ok: true,
      asOf: new Date().toISOString(),
      account: st ? {
        startBalance: Number(st.start_balance), realizedPnl: Number(st.realized_pnl),
        equity: Number(st.equity), floatingPnl: Number(st.floating_pnl),
        openCount: Number(st.open_count), usedMargin: Number(st.used_margin),
        updatedAt: st.updated_at, stale: stateAgeMs > 30 * 60 * 1000,
      } : null,
      openPositions,
      todayClosed,
      realizedTodayUsd: realizedToday,
      halted, haltUntil,
      limits: { maxOpenTotal: 5, maxOpenAgent: 3, agentMaxLot: 0.02, agentMinScore: 80, dailyLossLimitPct: 10 },
    });
  } catch (e) {
    return res.status(502).json({ ok: false, error: `Lỗi agent-brief: ${String(e.message || e).slice(0, 200)}` });
  }
}
