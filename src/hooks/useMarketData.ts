import { useState, useEffect, useRef, useCallback } from 'react';
import { Asset, Signal, NewsEvent, MarketSnapshot, DataSource } from '../types';
import { INITIAL_ASSETS } from '../data/mockData';
import { fetchAllQuotes, fetchKrakenHistory } from '../lib/marketData';
import { fetchEconomicCalendar, getNewsSourceName } from '../lib/news';
import { PriceHistory, evaluateSignal } from '../lib/signalEngine';
import { observeCandidate } from '../lib/neural/observer';
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
  const dayOpenRef = useRef<Record<string, { day: string; open: number }>>({});
  const equityRef = useRef(equity);
  const riskRef = useRef(riskPct);
  equityRef.current = equity;
  riskRef.current = riskPct;

  const applyQuotes = useCallback(
    (quotes: Record<string, { price: number; change24h: number; source: DataSource; sourceName: string }>, news: NewsEvent[]) => {
      const history = historyRef.current;
      const today = new Date().toISOString().slice(0, 10);

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
      const [btcHist, ethHist, news] = await Promise.all([
        fetchKrakenHistory('XBTUSD', 60),
        fetchKrakenHistory('ETHUSD', 60),
        fetchEconomicCalendar(),
      ]);
      if (cancelled) return;
      if (btcHist.length) historyRef.current.seed('BTCUSD', btcHist);
      if (ethHist.length) historyRef.current.seed('ETHUSD', ethHist);
      setState((prev) => ({ ...prev, news, newsSource: getNewsSourceName() }));
      const quotes = await fetchAllQuotes();
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
      const quotes = await fetchAllQuotes();
      const news = await fetchEconomicCalendar();
      setState((prev) => ({ ...prev, news, newsSource: getNewsSourceName() }));
      applyQuotes(quotes, news);
    };
    const fastId = window.setInterval(tickFast, CRYPTO_POLL_MS);
    // Forex trong fetchAllQuotes đã gộp; tách nhịp riêng để đỡ tải:
    forexTimer = window.setInterval(async () => {
      const quotes = await fetchAllQuotes();
      const news = await fetchEconomicCalendar();
      applyQuotes(quotes, news);
    }, FOREX_POLL_MS);
    const newsId = window.setInterval(async () => {
      const news = await fetchEconomicCalendar();
      setState((prev) => ({ ...prev, news, newsSource: getNewsSourceName() }));
    }, NEWS_POLL_MS);
    return () => {
      window.clearInterval(fastId);
      window.clearInterval(forexTimer);
      window.clearInterval(newsId);
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
