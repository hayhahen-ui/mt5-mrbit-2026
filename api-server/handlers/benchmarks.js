/**
 * /api/benchmarks.js — Kho strategy tham chiếu (ĐỐI ỨNG BENCHMARK).
 *
 * GET    → liệt kê strategies kèm trades (embed), mới nhất trước
 * POST   {name, source?, sourceNote?, sourceUrl?, id?} → tạo strategy
 * DELETE ?id= → xóa strategy (trades cascade theo FK)
 *
 * Ghi theo pattern browser của positions API (không cần key).
 * Nếu bảng chưa được migrate (002_benchmark.sql) → 503 kèm hướng dẫn.
 */
import { configured, cors, env, q, ins } from '../../api/_supa.js';

const TABLE_MISSING = /benchmark_strategies|relation .* does not exist/i;

function toStrategy(row) {
  const trades = Array.isArray(row.benchmark_trades) ? row.benchmark_trades : [];
  return {
    id: row.id,
    name: row.name,
    source: row.source,
    sourceNote: row.source_note || undefined,
    sourceUrl: row.source_url || undefined,
    createdAt: row.created_at,
    trades: trades.map((t) => ({
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
    })),
  };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!configured()) return res.status(503).json({ ok: false, error: 'Server chưa cấu hình Supabase (SUPABASE_URL/SUPABASE_SERVICE_KEY). App chạy local-only.' });

  try {
    if (req.method === 'GET') {
      const rows = await q('/benchmark_strategies', {
        select: '*,benchmark_trades(*)',
        order: 'created_at.desc',
        limit: '50',
      });
      return res.status(200).json({ ok: true, strategies: rows.map(toStrategy) });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { return res.status(400).json({ ok: false, error: 'Body JSON không hợp lệ.' }); }
      }
      const name = String(body.name || '').slice(0, 120) || 'Benchmark';
      const source = ['vantage-copy', 'manual', 'other'].includes(body.source) ? body.source : 'manual';
      const genId = `BM-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const id = /^[A-Za-z0-9-]{8,64}$/.test(String(body.id || '')) ? String(body.id) : genId;
      const row = {
        id,
        name,
        source,
        source_note: String(body.sourceNote || '').slice(0, 500) || null,
        source_url: String(body.sourceUrl || '').slice(0, 500) || null,
      };
      const created = await ins('/benchmark_strategies', [row]).catch((e) => {
        if (String(e.message || '').includes('409')) return [row];
        throw e;
      });
      return res.status(200).json({ ok: true, strategy: toStrategy({ ...created[0], benchmark_trades: [] }) });
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id || '');
      if (!id) return res.status(400).json({ ok: false, error: 'Thiếu ?id=' });
      const { url, key } = env();
      const r = await fetch(`${url}/rest/v1/benchmark_strategies?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (!r.ok) throw new Error(`Supabase ${r.status}`);
      return res.status(200).json({ ok: true, deleted: id });
    }

    return res.status(405).json({ ok: false, error: 'GET/POST/DELETE only' });
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (TABLE_MISSING.test(msg)) {
      return res.status(503).json({ ok: false, error: 'Chưa chạy migration 002_benchmark.sql trên Supabase (SQL Editor).' });
    }
    return res.status(502).json({ ok: false, error: `Lỗi benchmarks API: ${msg.slice(0, 200)}` });
  }
}
