/**
 * /api/benchmark-trades.js — Lệnh của strategy tham chiếu (ĐỐI ỨNG BENCHMARK).
 *
 * GET  ?strategyId=          → liệt kê trades (mới nhất trước, tối đa 5000)
 * POST {strategyId, trades:[{symbol,direction,openTime?,closeTime?,openPrice?,closePrice?,lot?,pnlUsd,riskUsd?,rMultiple?,pips?,note?,id?}]}
 *      → chèn bulk (bỏ qua id trùng — 409 → đếm conflicted)
 * DELETE ?strategyId=        → xóa toàn bộ trades của strategy
 *
 * Ghi theo pattern browser của positions API (không cần key).
 * Trần 5000 lệnh/strategy — vượt trần → 409, giữ nguyên dữ liệu cũ.
 */
import { configured, cors, env, q, ins } from '../../api/_supa.js';

const MAX_TRADES = 5000;
const TABLE_MISSING = /benchmark_trades|relation .* does not exist/i;

function toTrade(t) {
  return {
    id: t.id,
    symbol: t.symbol,
    direction: t.direction,
    openTime: t.open_time,
    closeTime: t.close_time,
    openPrice: Number(t.open_price),
    closePrice: Number(t.close_price),
    lot: Number(t.lot),
    pnlUsd: Number(t.pnl_usd),
    riskUsd: t.risk_usd == null ? undefined : Number(t.risk_usd),
    rMultiple: Number(t.r_multiple),
    rKnown: !!t.r_known,
    pips: Number(t.pips),
    note: t.note || undefined,
  };
}

function errMsg(e) {
  const m = String((e && e.message) || e);
  if (TABLE_MISSING.test(m)) {
    return { status: 503, error: 'Chưa chạy migration 002_benchmark.sql trên Supabase (SQL Editor).' };
  }
  return { status: 502, error: `Lỗi benchmark-trades API: ${m.slice(0, 200)}` };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!configured()) return res.status(503).json({ ok: false, error: 'Server chưa cấu hình Supabase (SUPABASE_URL/SUPABASE_SERVICE_KEY). App chạy local-only.' });

  try {
    const strategyId = String(req.query.strategyId || req.body?.strategyId || '');

    if (req.method === 'GET') {
      if (!strategyId) return res.status(400).json({ ok: false, error: 'Thiếu ?strategyId=' });
      const rows = await q('/benchmark_trades', {
        strategy_id: `eq.${strategyId}`,
        select: '*',
        order: 'close_time.desc',
        limit: String(MAX_TRADES),
      });
      return res.status(200).json({ ok: true, trades: rows.map(toTrade) });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { return res.status(400).json({ ok: false, error: 'Body JSON không hợp lệ.' }); }
      }
      const sid = String(body.strategyId || '');
      const trades = Array.isArray(body.trades) ? body.trades : [];
      if (!sid) return res.status(400).json({ ok: false, error: 'Thiếu strategyId.' });
      if (trades.length === 0) return res.status(400).json({ ok: false, error: 'trades rỗng.' });
      if (trades.length > MAX_TRADES) return res.status(409).json({ ok: false, error: `Vượt trần ${MAX_TRADES} lệnh/lần.` });

      // Strategy phải tồn tại
      const st = await q('/benchmark_strategies', { id: `eq.${sid}`, select: 'id', limit: 1 });
      if (!st || st.length === 0) return res.status(404).json({ ok: false, error: 'Strategy không tồn tại.' });

      const existing = await q('/benchmark_trades', { strategy_id: `eq.${sid}`, select: 'id', limit: String(MAX_TRADES) });
      if (existing.length + trades.length > MAX_TRADES) {
        return res.status(409).json({ ok: false, error: `Vượt trần ${MAX_TRADES} lệnh/strategy (đang có ${existing.length}). Giữ nguyên dữ liệu cũ.` });
      }

      const rows = [];
      const skipped = [];
      for (const t of trades) {
        const symbol = String(t.symbol || '').toUpperCase().slice(0, 20);
        const direction = String(t.direction || '').toUpperCase();
        const pnlUsd = Number(t.pnlUsd);
        if (!symbol || (direction !== 'BUY' && direction !== 'SELL') || !isFinite(pnlUsd)) {
          skipped.push(String(t.symbol || '?'));
          continue;
        }
        const riskUsd = t.riskUsd == null || t.riskUsd === '' ? null : Number(t.riskUsd);
        const rKnown = typeof t.rMultiple === 'number' || (typeof riskUsd === 'number' && riskUsd > 0);
        const rMultiple = typeof t.rMultiple === 'number'
          ? Number(t.rMultiple.toFixed(2))
          : riskUsd && riskUsd > 0 ? Number((pnlUsd / riskUsd).toFixed(2)) : 0;
        const id = /^[A-Za-z0-9-]{8,64}$/.test(String(t.id || ''))
          ? String(t.id)
          : `BT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${rows.length}`;
        rows.push({
          id,
          strategy_id: sid,
          symbol,
          direction,
          open_time: t.openTime || null,
          close_time: t.closeTime || new Date().toISOString(),
          open_price: Number(t.openPrice) || 0,
          close_price: Number(t.closePrice) || 0,
          lot: Number(t.lot) || 0,
          pnl_usd: Number(pnlUsd.toFixed(2)),
          risk_usd: riskUsd,
          r_multiple: rMultiple,
          r_known: rKnown,
          pips: Number(t.pips) || 0,
          note: String(t.note || '').slice(0, 500) || null,
        });
      }
      let inserted = 0;
      let conflicted = 0;
      if (rows.length > 0) {
        try {
          const out = await ins('/benchmark_trades', rows);
          inserted = Array.isArray(out) ? out.length : rows.length;
        } catch (e) {
          // 409 = trùng id (import lại) → thử từng dòng, bỏ qua dòng trùng
          if (String(e.message || '').includes('409')) {
            for (const r of rows) {
              try { await ins('/benchmark_trades', [r]); inserted++; }
              catch { conflicted++; }
            }
          } else throw e;
        }
      }
      return res.status(200).json({ ok: true, inserted, conflicted, skipped: skipped.length });
    }

    if (req.method === 'DELETE') {
      if (!strategyId) return res.status(400).json({ ok: false, error: 'Thiếu ?strategyId=' });
      const { url, key } = env();
      const r = await fetch(`${url}/rest/v1/benchmark_trades?strategy_id=eq.${encodeURIComponent(strategyId)}`, {
        method: 'DELETE',
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (!r.ok) throw new Error(`Supabase ${r.status}`);
      return res.status(200).json({ ok: true, cleared: strategyId });
    }

    return res.status(405).json({ ok: false, error: 'GET/POST/DELETE only' });
  } catch (e) {
    const { status, error } = errMsg(e);
    return res.status(status).json({ ok: false, error });
  }
}
