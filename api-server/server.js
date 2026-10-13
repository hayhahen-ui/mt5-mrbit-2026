/**
 * server.js — API nấc 2 chạy trên Render Web Service (free tier).
 *
 * Mount các handler Vercel-style trong ../api/*.js qua adapter Express.
 * Các handler chỉ dùng req.query / req.body / req.headers / req.method
 * và res.status().json() / res.setHeader() — tương thích Express nguyên bản.
 *
 * Thêm endpoint mới: copy 1 dòng mount(...) bên dưới.
 * Các API còn lại (fred, twelvedata, shared, ff-calendar...) vẫn ở Vercel.
 */
import express from 'express';
import positions from '../api/positions.js';
import positionClose from '../api/position-close.js';
import positionUpdate from '../api/position-update.js';
import accountState from '../api/account-state.js';
import agentBrief from '../api/agent-brief.js';

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

app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'mt5-mrbit-2026-api' }));

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`mt5-mrbit-2026-api listening on :${port}`));
