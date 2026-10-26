import { useState, useEffect, useRef, useCallback } from 'react';
import { Asset, Signal, NewsEvent, MarketSnapshot, DataSource } from '../types';
import { INITIAL_ASSETS } from '../data/mockData';
import { fetchAllQuotes, fetchGoldQuote, fetchKrakenHistory } from '../lib/marketData';
import { Quote } from '../types';
import { getTdKey, tdCandles, TD_LIST, TD_QUOTE_LIST, tdHasQuota, sleep, TD_GAP_MS, recordTdError, clearTdError } from '../lib/twelvedata';
import { mergeTdCandles } from '../lib/tdStore';
import { getGhPat, ghAutoSync, ghSyncNow } from '../lib/ghSync';
import { migrateKaizenToIdb } from '../lib/kaizen';
import { migrateNeuralToIdb } from '../lib/neural/repository';
import { recordPricePoints } from '../lib/priceHistory';
import { fetchEconomicCalendar, getNewsSourceName } from '../lib/news';
import { PriceHistory, evaluateSignal } from '../lib/signalEngine';
import { getEngineToggles } from '../lib/engines';
import { guardQuote } from '../lib/quoteGuard';
import { observeCandidate } from '../lib/neural/observer';
import { recordPrices, seedCloses, HEATMAP_SYMBOLS } from '../lib/priceHistory';
import { maybeForexSnapshot } from '../lib/forexJournal';
import { totalScore } from '../lib/scoring';
import { maybeRelaySignal } from '../lib/signalRelay';
import { fetchFredSnapshotOnline, snapshotToSeries } from '../lib/research/fredStore';
import { fetchAllFred } from '../lib/research/fred';
import { computeMacroOnly } from '../lib/research/directionScore';
import { getCachedOutlook, findSentiment } from '../lib/sentiment';
import { getGoldFlow } from '../lib/research/useDirectionScores';
import { fetchGoldFlows } from '../lib/research/goldFlows';

export interface MarketDataState {
  assets: Asset[];
  signals: Record<string, Signal>;
  snapshots: Record<string, MarketSnapshot>;
  news: NewsEvent[];
  newsSource: string;
  lastUpdated: number;
  loading: boolean;
}

const KRAKEN_PAIR: Record<string, string> = { BTCUSD: 'XBTUSD', ETHUSD: 'ETHUSD' };

/** Cache điểm vĩ mô (tính 1 lần, dùng cho mọi lần evaluate) */
let macroCache: Record<string, { score: number | null; coveragePct: number }> | null = null;
let macroCacheAt = 0;
const MACRO_TTL = 30 * 60 * 1000; // 30 phút

function getMacroScoresSync(): Record<string, { score: number | null; coveragePct: number }> {
  // Trigger refresh nền nếu hết hạn (không block)
  if (!macroCache || Date.now() - macroCacheAt >= MACRO_TTL) {
    getMacroScoresAsync().catch(() => { /* lặng lẽ */ });
  }
  return macroCache || {};
}

async function getMacroScoresAsync(): Promise<Record<string, { score: number | null; coveragePct: number }>> {
  if (macroCache && Date.now() - macroCacheAt < MACRO_TTL) return macroCache;
  try {
    // FRED: kho online → API
    let fred = null;
    const online = await fetchFredSnapshotOnline();
    if (online && online.ageH < 36) fred = snapshotToSeries(online.snap);
    else fred = await fetchAllFred();
    const hasData = Object.values(fred).some((s: any) => !s.error && s.latest);
    if (!hasData) return macroCache || {};
    const outlook = getCachedOutlook();
    const goldFlowManual = getGoldFlow();
    const flows = await fetchGoldFlows().catch(() => null);
    const wgcOnline = flows?.wgc?.flowTons ?? null;
    const gldSignal = flows?.gld?.signal ?? null;
    const out: Record<string, { score: number | null; coveragePct: number }> = {};
    for (const sym of ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD']) {
      const sent = findSentiment(outlook, sym);
      out[sym] = computeMacroOnly({
        symbol: sym, fred,
        priceDirection: 'FLAT', priceScore: 50,
        sentimentLongPct: sent ? sent.longPct : null,
        goldFlowTons: sym === 'XAUUSD' ? (wgcOnline !== null ? wgcOnline : goldFlowManual) : null,
        gldSignal: sym === 'XAUUSD' ? gldSignal : null,
      });
    }
    macroCache = out; macroCacheAt = Date.now();
    return out;
  } catch { return macroCache || {}; }
}
const CRYPTO_POLL_MS = 60000;
const FOREX_POLL_MS = 600000;
const NEWS_POLL_MS = 900000;
// Vàng poll nhanh riêng 20s (fix 15/10): quote 60s khiến cắt-lỗ-sớm trượt mạnh
// trong thị trường rơi nhanh — bot chỉ cắt được ở quote đầu tiên nhìn thấy.
// 20s ≈ 4.320 req/ngày, chỉ gọi gold-api, không ảnh hưởng nhịp forex/crypto.

/**
 * Hook dữ liệu thị trường THẬT:
 * - Seed lịch sử Kraken cho BTC/ETH ngay khi mount (engine có tín hiệu tức thì)
 * - Poll giá thật theo lịch; US30 giữ mô phỏng 1s (ghi rõ SIM)
 * - Mỗi lần có giá mới → engine đánh giá lại tín hiệu + ghi nhật ký Kaizen
 */
export function useMarketData(equity: number, riskPct: number): MarketDataState {
  const [state, setState] = useState<MarketDataState>({
    assets: INITIAL_ASSETS.map((a) => ({ ...a, dataSource: 'OFFLINE' as DataSource, sourceName: 'Đang kết nối…', warmup: '0/20' })),
    signals: {},
    snapshots: {},
    news: [],
    newsSource: '…',
    lastUpdated: 0,
    loading: true,
  });

  const historyRef = useRef(new PriceHistory());
  /** Giá forex mới nhất từ TwelveData { sym: { price, at } } */
  const tdRef = useRef<Record<string, { price: number; at: number }>>({});
  /** Ghi đè quote forex bằng giá TwelveData nếu còn tươi (<45'). */
  const tdOverride = (quotes: Record<string, Quote>): Record<string, Quote> => {
    const now = Date.now();
    for (const sym of TD_QUOTE_LIST) {
      const q = tdRef.current[sym];
      if (q && now - q.at < 45 * 60_000) {
        quotes[sym] = {
          symbol: sym, price: q.price, change24h: 0,
          source: 'LIVE' as const, sourceName: 'TwelveData', updatedAt: now,
        };
      }
    }
    return quotes;
  };
  /** Chống 2 vòng TwelveData chạy chồng nhau (nguyên nhân spike vượt 8 credit/phút). */
  const tdRunningRef = useRef(false);
  /** 1 chu kỳ TwelveData: nến 5m → kho masterdata → seed engine → heatmap → quotes. */
  const runTdCycle = useCallback(async (): Promise<boolean> => {
    if (tdRunningRef.current) return false;
    if (!getTdKey() || !tdHasQuota(TD_LIST.length)) return false;
    tdRunningRef.current = true;
    let ok = false;
    try {
    for (let i = 0; i < TD_LIST.length; i++) {
      const sym = TD_LIST[i];
      try {
        const candles = await tdCandles(sym, 96);
        if (candles.length >= 5) {
          mergeTdCandles(sym, candles);
          recordPricePoints(sym, candles.map((c) => ({ t: c.t, p: c.c })));
          const closes = candles.map((c) => c.c);
          historyRef.current.seed(sym, closes);
          const last = candles[candles.length - 1];
          tdRef.current[sym] = { price: last.c, at: Date.now() };
          clearTdError(sym);
          ok = true;
        }
      } catch (e) {
        recordTdError(sym, e instanceof Error ? e.message : 'lỗi không rõ');
      }
      if (i < TD_LIST.length - 1) await sleep(TD_GAP_MS); // tôn trọng 8 credit/phút
    }
    } finally {
      tdRunningRef.current = false;
    }
    try { window.dispatchEvent(new CustomEvent('td-updated')); } catch { /* noop */ }
    return ok;
  }, []);
  const dayOpenRef = useRef<Record<string, { day: string; open: number }>>({});
  /** Giá hợp lệ cuối cùng theo mã — mốc để phát hiện tick ảo */
  const lastPriceRef = useRef<Record<string, number>>({});
  const equityRef = useRef(equity);
  const riskRef = useRef(riskPct);
  equityRef.current = equity;
  riskRef.current = riskPct;

  const applyQuotes = useCallback(
    (quotes: Record<string, { price: number; change24h: number; source: DataSource; sourceName: string }>, news: NewsEvent[]) => {
      const history = historyRef.current;
      const today = new Date().toISOString().slice(0, 10);

      // LƯỚI LỌC TICK ẢO: mọi quote qua guardQuote trước khi vào giá/heatmap/engine.
      // Tick nhảy quá ngưỡng (vd Gold-API trả giá stale) bị từ chối, giữ giá cũ.
      const clean: typeof quotes = {};
      for (const [sym, q] of Object.entries(quotes)) {
        if (!q || q.source === 'OFFLINE' || !Number.isFinite(q.price) || q.price <= 0) continue;
        const g = guardQuote(sym, q.price, lastPriceRef.current[sym] || 0);
        if (g.accept) clean[sym] = q;
      }

      // Nhật ký dữ liệu forex: ghi lịch sử giá (heatmap) + snapshot 15 phút
      try {
        const realPrices: Record<string, number> = {};
        for (const [sym, q] of Object.entries(clean)) {
          if (q && q.source !== 'OFFLINE' && Number.isFinite(q.price) && q.price > 0) {
            realPrices[sym] = q.price;
          }
        }
        recordPrices(realPrices);
        const highNews = (news || []).filter((e) => e.impact === 'HIGH');
        const newsHigh = highNews.length;
        const newsTop = highNews.slice(0, 12).map((e) => `${e.currency} ${e.title}`);
        maybeForexSnapshot(realPrices, newsHigh, newsTop);
      } catch { /* không để journal làm hỏng luồng giá */ }

      setState((prev) => {
        const assets = prev.assets.map((a) => {
          const q = clean[a.symbol];
          let price = a.price;
          let change24h = a.change24h;
          let source: DataSource = a.dataSource || 'OFFLINE';
          let sourceName = a.sourceName || '—';
          // updatedAt chỉ cập nhật khi có quote thật — làm tín hiệu "giá tươi",
          // để engine tự đóng lệnh không chạy trên giá mock lúc mới tải trang (fix F5 tự đóng lệnh)
          let updatedAt = a.updatedAt || 0;

          if (q) {
            price = q.price;
            source = q.source;
            sourceName = q.sourceName;
            updatedAt = Date.now();
            // % 24h: ưu tiên nguồn có sẵn, nếu không thì tính từ giá mở đầu ngày đã thấy
            if (q.change24h !== 0) {
              change24h = q.change24h;
            } else {
              const rec = dayOpenRef.current[a.symbol];
              if (!rec || rec.day !== today) dayOpenRef.current[a.symbol] = { day: today, open: price };
              const open = dayOpenRef.current[a.symbol].open;
              change24h = open > 0 ? Number((((price - open) / open) * 100).toFixed(2)) : 0;
            }
            // Chỉ quote live vượt lưới lọc mới được làm mốc cho guard —
            // giá mock/OFFLINE không bao giờ thành baseline.
            if (price > 0) lastPriceRef.current[a.symbol] = price;
            history.push(a.symbol, price);
          }

          return { ...a, price, change24h, dataSource: source, sourceName, updatedAt, warmup: history.warmup(a.symbol) };
        });

        // Engine đánh giá lại toàn bộ (lấy điểm vĩ mô 1 lần cho tất cả mã)
        const signals: Record<string, Signal> = {};
        const snapshots: Record<string, MarketSnapshot> = {};
        const macroScores = getMacroScoresSync();
        const nextAssets = assets.map((a) => {
          const macro = macroScores[a.symbol];
          const { signal, snapshot, rawFeatures } = evaluateSignal(
            {
              asset: a,
              price: a.price,
              change24h: a.change24h,
              dataSource: a.dataSource || 'OFFLINE',
              sourceName: a.sourceName || '—',
              news,
              equity: equityRef.current,
              riskPct: riskRef.current,
              engines: getEngineToggles(),
              macroScore: macro?.score ?? null,
              macroCoverage: macro?.coveragePct ?? 0,
            },
            history
          );
          snapshots[a.symbol] = snapshot;
          if (signal) {
            signals[a.symbol] = signal;
            maybeRelaySignal(signal);

            // Neural shadow: quan sát ứng viên, không can thiệp quyết định (skill §5)
            if (signal.direction !== 'FLAT') {
              try {
                observeCandidate({
                  symbol: a.symbol,
                  direction: signal.direction,
                  engine: signal.engine,
                  engineName: signal.engineName,
                  ruleScore: totalScore(signal.scoreBreakdown),
                  ruleComponents: (signal.scoreBreakdown || []).map((f) => ({
                    id: f.id, label: f.label, points: f.points, maxPoints: f.maxPoints, passed: f.passed,
                  })),
                  eligibility: snapshot.newsNear.length > 0 && signal.isHeadsUp ? 'blocked_news' : 'eligible',
                  blockReason: signal.isHeadsUp ? 'news_window' : undefined,
                  plan: {
                    entry: signal.entryPrice, stop: signal.stopLoss,
                    tp1: signal.tp1, tp2: signal.tp2, tp3: signal.tp3,
                    suggestedLot: signal.suggestedLot,
                  },
                  rawFeatures,
                  provenance: {
                    source: a.sourceName || '—',
                    asOf: new Date().toISOString(),
                    availableAt: new Date(a.updatedAt || Date.now()).toISOString(),
                    warmup: snapshot.warmup,
                  },
                  dataOrigin: 'live_observed',
                });
              } catch { /* observer không bao giờ chặn luồng tín hiệu */ }
            }

            return {
              ...a,
              trendH1: (signal.direction === 'FLAT' ? 'FLAT' : signal.direction === 'BUY' ? 'BULL' : 'BEAR') as Asset['trendH1'],
              signalDir: signal.direction,
              quality: signal.quality,
            };
          }
          return { ...a, signalDir: 'FLAT' as const, quality: 'Q2' as const };
        });

        return { ...prev, assets: nextAssets, signals, snapshots, lastUpdated: Date.now(), loading: false };
      });
    },
    []
  );

  // Seed lịch sử + nạp tin tức lần đầu
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Di trú nhật ký nặng sang IndexedDB (1 lần, không mất dữ liệu)
      migrateKaizenToIdb().catch(() => { /* noop */ });
      migrateNeuralToIdb().catch(() => { /* noop */ });
      const tdPromise = runTdCycle();
      const [btcHist, ethHist, news] = await Promise.all([
        fetchKrakenHistory('XBTUSD', 60),
        fetchKrakenHistory('ETHUSD', 60),
        fetchEconomicCalendar(),
      ]);
      if (cancelled) return;
      await tdPromise; // nến 5m thật ưu tiên seed engine trước
      // Seed warmup engine từ kho giá localStorage — chỉ lấp mã chưa có nến TwelveData
      try {
        for (const sym of HEATMAP_SYMBOLS) {
          if (historyRef.current.get(sym).length >= 20) continue;
          const closes = seedCloses(sym, 120);
          if (closes.length >= 5) historyRef.current.seed(sym, closes);
        }
      } catch { /* bỏ qua */ }
      if (btcHist.length) historyRef.current.seed('BTCUSD', btcHist);
      if (ethHist.length) historyRef.current.seed('ETHUSD', ethHist);
      setState((prev) => ({ ...prev, news, newsSource: getNewsSourceName() }));
      const quotes = tdOverride(await fetchAllQuotes());
      if (cancelled) return;
      const freshNews = await fetchEconomicCalendar();
      applyQuotes(quotes, freshNews);
    })();
    return () => { cancelled = true; };
  }, [applyQuotes]);

  // Poll giá: crypto+vàng 60s, forex 10'
  useEffect(() => {
    let forexTimer = 0;
    const tickFast = async () => {
      const quotes = tdOverride(await fetchAllQuotes());
      const news = await fetchEconomicCalendar();
      setState((prev) => ({ ...prev, news, newsSource: getNewsSourceName() }));
      applyQuotes(quotes, news);
    };
    const fastId = window.setInterval(tickFast, CRYPTO_POLL_MS);
    // Vàng poll nhanh 20s: chỉ gold-api, qua quoteGuard như thường lệ.
    // Vòng auto-close trong App chạy theo mỗi lần assets đổi → cắt lỗ sát giá hơn.
    const goldFastId = window.setInterval(async () => {
      try {
        const q = await fetchGoldQuote();
        if (q) applyQuotes({ XAUUSD: q }, []);
      } catch { /* lỗi mạng thì bỏ qua, 20s sau thử lại */ }
    }, 20000);
    // Tự tỉnh lại khi tab hiện lại: trình duyệt treo/throttle timer của tab nền
    // (thậm chí discard tab) nên giá đứng yên cho tới khi user click lung tung.
    // Nghe visibilitychange + focus: vừa quay lại tab là kéo giá mới ngay,
    // không chờ tới kỳ poll kế tiếp, không cần click vào trong trang.
    const refreshNow = () => {
      if (document.visibilityState === 'hidden') return;
      void tickFast();
      void (async () => {
        try {
          const q = await fetchGoldQuote();
          if (q) applyQuotes({ XAUUSD: q }, []);
        } catch { /* lần poll 20s kế tiếp thử lại */ }
      })();
    };
    document.addEventListener('visibilitychange', refreshNow);
    window.addEventListener('focus', refreshNow);
    // Forex trong fetchAllQuotes đã gộp; tách nhịp riêng để đỡ tải:
    forexTimer = window.setInterval(async () => {
      const quotes = tdOverride(await fetchAllQuotes());
      const news = await fetchEconomicCalendar();
      applyQuotes(quotes, news);
    }, FOREX_POLL_MS);
    const tdManual = () => { runTdCycle(); };
    window.addEventListener('td-refresh-now', tdManual);
    // TwelveData: làm mới nến 5m mỗi 30 phút (~530 credit/ngày cho 11 mã, trong hạn 800)
    // GitHub auto-sync masterdata mỗi 15 phút (chỉ khi user bật + có PAT)
    const ghId = window.setInterval(async () => {
      try {
        if (ghAutoSync() && getGhPat()) await ghSyncNow();
      } catch { /* lỗi mạng thì bỏ qua, lần sau thử lại */ }
    }, 15 * 60_000);
    const tdId = window.setInterval(async () => {
      const ok = await runTdCycle();
      if (ok) {
        const quotes = tdOverride(await fetchAllQuotes());
        const news = await fetchEconomicCalendar();
        setState((prev) => ({ ...prev, news, newsSource: getNewsSourceName() }));
        applyQuotes(quotes, news);
      }
    }, 30 * 60_000);
    const newsId = window.setInterval(async () => {
      const news = await fetchEconomicCalendar();
      setState((prev) => ({ ...prev, news, newsSource: getNewsSourceName() }));
    }, NEWS_POLL_MS);
    return () => {
      window.clearInterval(fastId);
      window.clearInterval(goldFastId);
      window.clearInterval(forexTimer);
      window.clearInterval(newsId);
      window.clearInterval(tdId);
      window.clearInterval(ghId);
      window.removeEventListener('td-refresh-now', tdManual);
      document.removeEventListener('visibilitychange', refreshNow);
      window.removeEventListener('focus', refreshNow);
    };
  }, [applyQuotes]);

  // US30 mô phỏng 1s (không có nguồn keyless) — ghi rõ SIM
  useEffect(() => {
    const id = window.setInterval(() => {
      const history = historyRef.current;
      setState((prev) => {
        const assets = prev.assets.map((a) => {
          if (a.symbol !== 'US30') return a;
          const delta = (Math.random() - 0.49) * 8;
          const price = Number((a.price + delta).toFixed(a.digits));
          history.push(a.symbol, price);
          return { ...a, price, dataSource: 'SIM' as DataSource, sourceName: 'Mô phỏng', updatedAt: Date.now(), warmup: history.warmup(a.symbol) };
        });
        return { ...prev, assets };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return state;
}
