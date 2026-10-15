/**
 * server.js — API nấc 2 chạy trên Render Web Service (free tier).
 *
 * Mount các handler trong ./handlers/*.js qua adapter Express.
 * (Đã dọn khỏi api/ để Vercel Hobby không vượt 12 serverless functions;
 *  api/ chỉ giữ các endpoint cũ: fred, twelvedata, shared, ff-calendar...).
 * Các handler chỉ dùng req.query / req.body / req.headers / req.method
 * và res.status().json() / res.setHeader() — tương thích Express nguyên bản.
 *
 * Thêm endpoint mới: copy 1 dòng mount(...) bên dưới.
 * Các API còn lại (fred, twelvedata, shared, ff-calendar...) vẫn ở Vercel.
 */
import express from 'express';
import positions from './handlers/positions.js';
import positionClose from './handlers/position-close.js';
import positionUpdate from './handlers/position-update.js';
import accountState from './handlers/account-state.js';
import agentBrief from './handlers/agent-brief.js';
import benchmarks from './handlers/benchmarks.js';
import benchmarkTrades from './handlers/benchmark-trades.js';
import kaizen from './handlers/kaizen.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

const mount = (path, handler) => {
  app.all(path, (req, res) => {
    try {
      const r = handler(req, res);
      if (r && typeof r.catch === 'function') {
        r.catch((e) => {
          if (!res.headersSent) res.status(502).json({ ok: false, error: String((e && e.message) || e).slice(0, 200) });
        });
      }
    } catch (e) {
      if (!res.headersSent) res.status(502).json({ ok: false, error: String((e && e.message) || e).slice(0, 200) });
    }
  });
};

mount('/api/positions', positions);
mount('/api/position-close', positionClose);
mount('/api/position-update', positionUpdate);
mount('/api/account-state', accountState);
mount('/api/agent-brief', agentBrief);
mount('/api/benchmarks', benchmarks);
mount('/api/benchmark-trades', benchmarkTrades);
mount('/api/kaizen', kaizen);

app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'mt5-mrbit-2026-api' }));

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`mt5-mrbit-2026-api listening on :${port}`));
