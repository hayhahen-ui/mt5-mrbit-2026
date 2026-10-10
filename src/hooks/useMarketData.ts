import { useState, useEffect, useRef, useCallback } from 'react';
import { Asset, Signal, NewsEvent, MarketSnapshot, DataSource } from '../types';
import { INITIAL_ASSETS } from '../data/mockData';
import { fetchAllQuotes, fetchKrakenHistory } from '../lib/marketData';
import { Quote } from '../types';
import { getTdKey, tdCandles, TD_LIST, TD_QUOTE_LIST, tdHasQuota, sleep, TD_GAP_MS, recordTdError, clearTdError } from '../lib/twelvedata';
import { mergeTdCandles } from '../lib/tdStore';
import { getGhPat, ghAutoSync, ghSyncNow } from '../lib/ghSync';
import { migrateKaizenToIdb } from '../lib/kaizen';
import { migrateNeuralToIdb } from '../lib/neural/repository';
import { recordPricePoints } from '../lib/priceHistory';
import { fetchEconomicCalendar, getNewsSourceName } from '../lib/news';
import { PriceHistory, evaluateSignal } from '../lib/signalEngine';
import { observeCandidate } from '../lib/neural/observer';
import { recordPrices, seedCloses, HEATMAP_SYMBOLS } from '../lib/priceHistory';
import { maybeForexSnapshot } from '../lib/forexJournal';
import { totalScore } from '../lib/scoring';

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
const CRYPTO_POLL_MS = 60000;
const FOREX_POLL_MS = 600000;
const NEWS_POLL_MS = 900000;

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
  const equityRef = useRef(equity);
  const riskRef = useRef(riskPct);
  equityRef.current = equity;
  riskRef.current = riskPct;

  const applyQuotes = useCallback(
    (quotes: Record<string, { price: number; change24h: number; source: DataSource; sourceName: string }>, news: NewsEvent[]) => {
      const history = historyRef.current;
      const today = new Date().toISOString().slice(0, 10);

      // Nhật ký dữ liệu forex: ghi lịch sử giá (heatmap) + snapshot 15 phút
      try {
        const realPrices: Record<string, number> = {};
        for (const [sym, q] of Object.entries(quotes)) {
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
          const q = quotes[a.symbol];
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
            history.push(a.symbol, price);
          }

          return { ...a, price, change24h, dataSource: source, sourceName, updatedAt, warmup: history.warmup(a.symbol) };
        });

        // Engine đánh giá lại toàn bộ
        const signals: Record<string, Signal> = {};
        const snapshots: Record<string, MarketSnapshot> = {};
        const nextAssets = assets.map((a) => {
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
            },
            history
          );
          snapshots[a.symbol] = snapshot;
          if (signal) {
            signals[a.symbol] = signal;

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
      window.clearInterval(forexTimer);
      window.clearInterval(newsId);
      window.clearInterval(tdId);
      window.clearInterval(ghId);
      window.removeEventListener('td-refresh-now', tdManual);
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
