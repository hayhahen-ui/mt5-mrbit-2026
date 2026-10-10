/**
 * symbolNews.ts — Mapping tin tức theo mã (để lịch kinh tế không bị pha loãng
 * bởi tin chung): mỗi mã chỉ hiện tin của các đồng tiền liên quan.
 * Nguồn: ForexFactory calendar (đã lấy qua /api/ff-calendar).
 */
import { NewsEvent } from '../types';

/** Các đồng tiền ảnh hưởng trực tiếp tới mã */
export function currenciesForSymbol(symbol: string): string[] {
  const s = symbol.replace('#', '').toUpperCase();
  switch (s) {
    case 'XAUUSD': return ['USD'];
    case 'EURUSD': return ['EUR', 'USD'];
    case 'GBPUSD': return ['GBP', 'USD'];
    case 'USDJPY': return ['USD', 'JPY'];
    case 'AUDUSD': return ['AUD', 'USD'];
    case 'BTCUSD':
    case 'ETHUSD': return ['USD'];
    case 'US30': return ['USD'];
    default:
      // Cặp forex lạ: tách 2 đồng tiền từ tên mã (VD: EURGBP → EUR, GBP)
      if (/^[A-Z]{6}$/.test(s)) return [s.slice(0, 3), s.slice(3, 6)];
      return ['USD'];
  }
}

/** Slug trang market ForexFactory: forexfactory.com/market/<slug> */
export const FF_MARKET_SLUGS: Record<string, string> = {
  XAUUSD: 'goldusd',
  EURUSD: 'eurusd',
  GBPUSD: 'gbpusd',
  USDJPY: 'usdjpy',
  AUDUSD: 'audusd',
  BTCUSD: 'btcusd',
  ETHUSD: 'ethusd',
  NZDUSD: 'nzdusd',
  USDCAD: 'usdcad',
  USDCHF: 'usdchf',
  EURJPY: 'eurjpy',
  GBPJPY: 'gbpjpy',
  EURGBP: 'eurgbp',
};

export function ffMarketUrl(symbol: string): string | null {
  const slug = FF_MARKET_SLUGS[symbol.replace('#', '').toUpperCase()];
  return slug ? `https://www.forexfactory.com/market/${slug}` : null;
}

/** Lọc tin theo mã: chỉ tiền liên quan, HIGH trước rồi tới giờ. */
export function newsForSymbol(news: NewsEvent[], symbol: string, limit = 30): NewsEvent[] {
  const curs = new Set(currenciesForSymbol(symbol));
  const rank = { HIGH: 0, MED: 1, LOW: 2 } as const;
  return news
    .filter((e) => curs.has(e.currency.toUpperCase()))
    .sort((a, b) => (rank[a.impact] - rank[b.impact]) || a.time.localeCompare(b.time))
    .slice(0, limit);
}

/** Đếm tin HIGH liên quan trong cửa sổ — dùng cho cảnh báo riêng từng mã. */
export function highNewsCountForSymbol(news: NewsEvent[], symbol: string): number {
  const curs = new Set(currenciesForSymbol(symbol));
  return news.filter((e) => curs.has(e.currency.toUpperCase()) && e.impact === 'HIGH' && e.inWindow).length;
}
