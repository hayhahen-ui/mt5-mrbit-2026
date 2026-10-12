/**
 * researchRegistry.ts — Registry nguồn nghiên cứu theo Blueprint FX&GOLD (§4, §22).
 * Phân tầng A–E theo mục đích sử dụng + mapping driver cho từng tài sản (§4.2, §5).
 * Mỗi nguồn có: trạng thái truy cập, quyền sử dụng, tần suất — theo §4.3.
 * Không suy ra quyền API/thương mại từ việc đọc được trang web (§4.3).
 */

export type SourceTier = 'A' | 'B' | 'C' | 'D' | 'E';
export type AccessStatus = 'public_web' | 'api_key_free' | 'unverified' | 'manual_only';

export interface ResearchSource {
  id: string;            // S01..S46 theo Blueprint §22
  name: string;
  url: string;
  tier: SourceTier;
  provides: string;      // thông tin cung cấp
  access: AccessStatus;  // trạng thái truy cập đã xác minh
  frequency: string;     // tần suất cập nhật logic
  note?: string;
}

export const TIER_META: Record<SourceTier, { title: string; desc: string }> = {
  A: { title: 'A — Công bố gốc', desc: 'Ngân hàng trung ương, cơ quan thống kê: quyết định, số liệu, lịch công bố' },
  B: { title: 'B — Dữ liệu chuyên ngành', desc: 'FRED, CFTC, CME, WGC, LBMA: chuỗi kinh tế, vị thế, kỳ vọng lãi suất, vàng' },
  C: { title: 'C — Tin & phân tích', desc: 'Reuters, ING THINK: bối cảnh và lập luận thị trường' },
  D: { title: 'D — Công cụ theo dõi', desc: 'ForexFactory, Investing, TradingView: lịch tổng hợp, biểu đồ' },
  E: { title: 'E — Feed giá giao dịch', desc: 'Bid/ask, OHLC, spread từ nhà cung cấp đã chọn' },
};

export const RESEARCH_SOURCES: ResearchSource[] = [
  // ---- Tầng A: công bố gốc ----
  { id: 'S01', name: 'Federal Reserve — FOMC', url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm', tier: 'A', provides: 'Lịch họp, thông cáo, biên bản, họp báo Fed', access: 'public_web', frequency: 'Theo lịch họp (~8 lần/năm)' },
  { id: 'S02', name: 'BLS — Lịch công bố', url: 'https://www.bls.gov/schedule/news_release/', tier: 'A', provides: 'CPI, việc làm Mỹ (NFP)', access: 'public_web', frequency: 'Hàng tháng' },
  { id: 'S03', name: 'BEA — Lịch công bố', url: 'https://www.bea.gov/news/schedule', tier: 'A', provides: 'GDP, thu nhập & chi tiêu Mỹ', access: 'public_web', frequency: 'Hàng quý/tháng' },
  { id: 'S04', name: 'BEA — PCE Price Index', url: 'https://www.bea.gov/data/personal-consumption-expenditures-price-index', tier: 'A', provides: 'Chỉ số giá PCE (thước đo lạm phát ưa thích của Fed)', access: 'public_web', frequency: 'Hàng tháng' },
  { id: 'S05', name: 'ECB — Chính sách tiền tệ', url: 'https://www.ecb.europa.eu/press/govcdec/mopo/html/index.en.html', tier: 'A', provides: 'Quyết định chính sách ECB', access: 'public_web', frequency: 'Theo lịch họp (~8 lần/năm)' },
  { id: 'S07', name: 'Eurostat', url: 'https://ec.europa.eu/eurostat/web/main/data/database', tier: 'A', provides: 'Thống kê khu vực euro', access: 'public_web', frequency: 'Hàng tháng/quý' },
  { id: 'S08', name: 'Bank of England', url: 'https://www.bankofengland.co.uk/monetary-policy', tier: 'A', provides: 'Quyết định, lịch, biên bản, phân bổ phiếu BoE', access: 'public_web', frequency: 'Theo lịch họp (8 lần/năm)' },
  { id: 'S09', name: 'ONS (Anh)', url: 'https://www.ons.gov.uk/economy', tier: 'A', provides: 'CPI, lương, việc làm, GDP Anh', access: 'public_web', frequency: 'Hàng tháng' },
  { id: 'S10', name: 'Bank of Japan', url: 'https://www.boj.or.jp/en/mopo/mpmsche_minu/index.htm', tier: 'A', provides: 'Quyết định & tài liệu chính sách BoJ', access: 'public_web', frequency: 'Theo lịch họp (8 lần/năm)' },
  { id: 'S11', name: 'MOF Japan — Can thiệp FX', url: 'https://www.mof.go.jp/english/policy/international_policy/reference/feio/index.html', tier: 'A', provides: 'Báo cáo can thiệp ngoại hối theo tháng/quý', access: 'public_web', frequency: 'Hàng tháng/quý' },
  { id: 'S12', name: 'Statistics Bureau Japan — CPI', url: 'https://www.stat.go.jp/english/data/cpi/', tier: 'A', provides: 'CPI Nhật Bản', access: 'public_web', frequency: 'Hàng tháng' },
  // ---- Tầng B: dữ liệu chuyên ngành ----
  { id: 'S13', name: 'CFTC — Commitments of Traders', url: 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm', tier: 'B', provides: 'Vị thế futures: chốt thứ Ba, công bố thứ Sáu', access: 'public_web', frequency: 'Hàng tuần', note: 'FX dùng TFF, vàng dùng Disaggregated. JPY futures báo giá USD/JPY — phải đảo chiều (§5.3).' },
  { id: 'S17', name: 'FRED — DGS2', url: 'https://fred.stlouisfed.org/series/DGS2', tier: 'B', provides: 'Lợi suất Treasury Mỹ 2 năm', access: 'api_key_free', frequency: 'Hàng ngày', note: 'Proxy điều kiện lãi suất Mỹ. Đã đấu nối API trong app.' },
  { id: 'S18', name: 'FRED — DGS10', url: 'https://fred.stlouisfed.org/series/DGS10', tier: 'B', provides: 'Lợi suất Treasury Mỹ 10 năm', access: 'api_key_free', frequency: 'Hàng ngày', note: 'Bối cảnh lãi suất dài hạn. Đã đấu nối API trong app.' },
  { id: 'S19', name: 'FRED — DFII10', url: 'https://fred.stlouisfed.org/series/DFII10', tier: 'B', provides: 'Lợi suất thực 10 năm (TIPS)', access: 'api_key_free', frequency: 'Hàng ngày', note: 'Biến tham chiếu chi phí cơ hội của vàng. Đã đấu nối API trong app.' },
  { id: 'S20', name: 'FRED — DTWEXBGS', url: 'https://fred.stlouisfed.org/series/DTWEXBGS', tier: 'B', provides: 'Chỉ số USD rổ rộng (Broad)', access: 'api_key_free', frequency: 'Hàng ngày', note: 'Khác ICE DXY về rổ. Đã đấu nối API trong app.' },
  { id: 'S21', name: 'FRED — T10YIE', url: 'https://fred.stlouisfed.org/series/T10YIE', tier: 'B', provides: 'Breakeven lạm phát 10 năm', access: 'api_key_free', frequency: 'Hàng ngày', note: 'Định giá lạm phát của thị trường. Đã đấu nối API trong app.' },
  { id: 'S22', name: 'World Gold Council — ETF', url: 'https://www.gold.org/goldhub/data/gold-etfs-holdings-and-flows', tier: 'B', provides: 'Lượng vàng nắm giữ & dòng vốn ETF', access: 'manual_only', frequency: 'Hàng tháng', note: 'Chưa có API tự động — đọc tay, nhập tay.' },
  { id: 'S24', name: 'LBMA — Gold Price', url: 'https://www.lbma.org.uk/prices-and-data/lbma-gold-price', tier: 'B', provides: 'Giá benchmark vàng (AM/PM)', access: 'public_web', frequency: 'Hàng ngày', note: 'Tham chiếu, không thay feed bid/ask.' },
  { id: 'S27', name: 'CME FedWatch', url: 'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html', tier: 'B', provides: 'Xác suất lãi suất từ Fed Funds futures', access: 'manual_only', frequency: 'Realtime (web)', note: 'Không chuyển thành xác suất thắng lệnh.' },
  // ---- Tầng C: tin & phân tích ----
  { id: 'S28', name: 'Reuters — Currencies', url: 'https://www.reuters.com/markets/currencies/', tier: 'C', provides: 'Tin ngoại hối, NHTW, kinh tế quốc tế', access: 'public_web', frequency: 'Liên tục', note: 'Phân biệt bài tin vs bài bình luận.' },
  { id: 'S29', name: 'ING THINK — FX', url: 'https://think.ing.com/category/fx/', tier: 'C', provides: 'Phân tích FX của ING', access: 'public_web', frequency: 'Hàng ngày', note: 'Dự báo chuyên gia ≠ dữ kiện tương lai.' },
  // ---- Tầng D: công cụ theo dõi ----
  { id: 'S30', name: 'ForexFactory — Calendar', url: 'https://www.forexfactory.com/calendar', tier: 'D', provides: 'Lịch công bố theo đồng tiền, mức ảnh hưởng', access: 'public_web', frequency: 'Liên tục', note: 'Đã đấu nối qua proxy nội bộ (tab NEWS).' },
  { id: 'S31', name: 'Investing.com (VN)', url: 'https://vn.investing.com/economic-calendar/', tier: 'D', provides: 'Lịch kinh tế tiếng Việt', access: 'public_web', frequency: 'Liên tục' },
  { id: 'S32', name: 'TradingView — Forex', url: 'https://www.tradingview.com/markets/currencies/', tier: 'D', provides: 'Biểu đồ, heatmap, ý tưởng cộng đồng', access: 'public_web', frequency: 'Realtime', note: 'Bài đăng cộng đồng ≠ xác nhận của nền tảng.' },
  // ---- Tầng E: feed giá (đã có trong app) ----
  { id: 'S40', name: 'Gold-API (XAUUSD)', url: 'https://api.gold-api.com/price/XAU', tier: 'E', provides: 'Giá vàng realtime 60s', access: 'public_web', frequency: '60 giây', note: 'Đã đấu nối trong app.' },
  { id: 'S41', name: 'Kraken (BTC/ETH)', url: 'https://api.kraken.com/0/public/Ticker', tier: 'E', provides: 'Giá crypto realtime + OHLC', access: 'public_web', frequency: '60 giây', note: 'Đã đấu nối trong app.' },
  { id: 'S42', name: 'TwelveData (FX 5m)', url: 'https://twelvedata.com/', tier: 'E', provides: 'Nến 5m 10 mã FX/metals', access: 'api_key_free', frequency: '30 phút', note: 'Đã đấu nối trong app (cần key free).' },
];

/** Driver vĩ mô cho từng tài sản — Blueprint §4.2, §5 */
export interface AssetDrivers {
  symbol: string;
  label: string;
  policy: string[];      // nguồn chính sách (tầng A)
  data: string[];        // nguồn dữ liệu (tầng B)
  keyQuestions: string[]; // câu hỏi bắt buộc §5
  pitfalls: string[];    // điểm dễ sai §5
}

export const ASSET_DRIVERS: AssetDrivers[] = [
  {
    symbol: 'EURUSD', label: 'EUR/USD',
    policy: ['S01', 'S05'], data: ['S17', 'S18', 'S20', 'S13', 'S28', 'S29'],
    keyQuestions: [
      'Fed và ECB thay đổi thông điệp thế nào so với kỳ họp trước?',
      'Chênh lệch lợi suất Mỹ–Đức thay đổi ra sao? (Đức là proxy, không đại diện hoàn hảo eurozone)',
      'Dữ liệu Mỹ bất ngờ ở: con số chính, thành phần, sửa đổi kỳ trước, hay tham gia lao động?',
    ],
    pitfalls: ['Lãi suất EUR tăng nhưng EUR/USD vẫn giảm nếu đã được định giá', 'Đếm 2 lần cùng 1 tin USD trên EUR/USD + DXY'],
  },
  {
    symbol: 'GBPUSD', label: 'GBP/USD',
    policy: ['S01', 'S08'], data: ['S17', 'S18', 'S20', 'S13', 'S09', 'S28'],
    keyQuestions: [
      'BoE: quyết định + biên bản + phân bổ phiếu — không chỉ đọc tiêu đề',
      'CPI dịch vụ, lương, thất nghiệp Anh từ ONS có đổi kỳ vọng chính sách?',
      'Lợi suất gilt tăng do kỳ vọng chính sách hay lo ngại tài khóa? (tin xấu cho GBP nếu là vế sau)',
    ],
    pitfalls: ['Lợi suất gilt tăng ≠ tin tốt cho GBP', 'Dùng EUR/GBP để tách sức mạnh riêng của GBP'],
  },
  {
    symbol: 'USDJPY', label: 'USD/JPY',
    policy: ['S01', 'S10', 'S11'], data: ['S17', 'S18', 'S13', 'S12'],
    keyQuestions: [
      'Chênh lệch lợi suất Mỹ–Nhật cùng kỳ hạn thay đổi thế nào?',
      'MOF có phát biểu leo thang / kiểm tra tỷ giá? (MOF quyết định, BoJ thực hiện)',
      'COT JPY: đã đảo đúng chiều USD/JPY chưa? (mua JPY futures ⟺ giảm USD/JPY)',
    ],
    pitfalls: ['Đọc sai chiều: tin tốt cho JPY = USD/JPY GIẢM', 'Mọi phiên chứng khoán giảm không đồng nghĩa JPY tăng'],
  },
  {
    symbol: 'XAUUSD', label: 'XAU/USD',
    policy: ['S01'], data: ['S19', 'S20', 'S21', 'S13', 'S22', 'S24'],
    keyQuestions: [
      'Lợi suất thực DFII10 thay đổi thế nào? (chi phí cơ hội của vàng)',
      'USD (DTWEXBGS) mạnh/yếu — nhưng không mặc định quan hệ luôn âm',
      'Dòng vốn ETF (WGC) và vị thế COT vàng: tập trung hay phân kỳ?',
    ],
    pitfalls: ['"Lạm phát tăng thì vàng tăng" — sai, cần xét lợi suất thực', 'Không ghép giá LBMA + spot broker + GC futures thành 1 chuỗi'],
  },
];

export function sourceById(id: string): ResearchSource | undefined {
  return RESEARCH_SOURCES.find((s) => s.id === id);
}

/** Nhãn bằng chứng theo Blueprint §1 */
export type EvidenceLabel = 'FACT' | 'CALCULATION' | 'INFERENCE' | 'SPECULATION' | 'UNVERIFIED';
export const EVIDENCE_META: Record<EvidenceLabel, { label: string; cls: string; desc: string }> = {
  FACT: { label: 'FACT', cls: 'bg-sky-950 text-sky-400 border-sky-800', desc: 'Dữ kiện có nguồn và thời điểm kiểm tra' },
  CALCULATION: { label: 'TÍNH TOÁN', cls: 'bg-violet-950 text-violet-400 border-violet-800', desc: 'Giá trị do chương trình tính, có đầu vào và công thức' },
  INFERENCE: { label: 'SUY LUẬN', cls: 'bg-amber-950 text-amber-400 border-amber-800', desc: 'Nhận định/suy luận từ dữ kiện' },
  SPECULATION: { label: 'KỊCH BẢN', cls: 'bg-orange-950 text-orange-400 border-orange-800', desc: 'Kịch bản có điều kiện, chưa xảy ra' },
  UNVERIFIED: { label: 'CHƯA XÁC MINH', cls: 'bg-[#17223b] text-slate-500 border-[#243356]', desc: 'Thiếu bằng chứng trực tiếp' },
};
