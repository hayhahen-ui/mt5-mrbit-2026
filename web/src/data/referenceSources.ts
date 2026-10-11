/**
 * referenceSources.ts — Kho nguồn tham chiếu do user sưu tầm (11/10/2026).
 * Dùng cho: (1) panel "NGUỒN THAM CHIẾU" ở tab NEWS (link bấm được),
 * (2) nạp vào prompt của mạng nơ-ron (các LLM ở nút AI PHÂN TÍCH / AI TÓM TẮT TIN)
 * để phân tích bám nguồn chính thống, có tác giả rõ ràng.
 */

export interface RefSource {
  name: string;
  url: string;
  provides: string; // thông tin cung cấp
  usage: string;    // cách dùng đề xuất
}

export interface RefCategory {
  id: string;
  title: string;
  sources: RefSource[];
}

export const REFERENCE_SOURCES: RefCategory[] = [
  {
    id: 'calendar',
    title: '📅 Lịch kinh tế',
    sources: [
      {
        name: 'Investing.com (tiếng Việt)',
        url: 'https://vn.investing.com/economic-calendar/',
        provides: 'Lịch kinh tế, số liệu thực tế, dự báo và kỳ trước; bộ lọc mức độ ảnh hưởng.',
        usage: 'Điểm bắt đầu nếu đọc tiếng Việt. Theo dõi lịch lãi suất, lạm phát, việc làm.',
      },
      {
        name: 'Forex Factory — Calendar',
        url: 'https://www.forexfactory.com/calendar',
        provides: 'Lịch công bố theo đồng tiền, mức ảnh hưởng dự kiến, số liệu các kỳ.',
        usage: 'Lọc đồng tiền đang theo dõi; chỉnh múi giờ về giờ Việt Nam. Ưu tiên mục Calendar.',
      },
    ],
  },
  {
    id: 'news',
    title: '📰 Tin tức',
    sources: [
      {
        name: 'Reuters — Currencies',
        url: 'https://www.reuters.com/markets/currencies/',
        provides: 'Tin ngoại hối, ngân hàng trung ương, diễn biến kinh tế quốc tế.',
        usage: 'Nắm sự kiện và yếu tố thị trường đang chú ý. Phân biệt bài tin với bài bình luận.',
      },
    ],
  },
  {
    id: 'official',
    title: '🏛️ Nguồn chính thức (số liệu gốc)',
    sources: [
      {
        name: 'Fed — FOMC',
        url: 'https://www.federalreserve.gov/monetarypolicy.htm',
        provides: 'Lịch họp, thông cáo, biên bản, họp báo, tài liệu dự báo của Fed.',
        usage: 'Đối chiếu trực tiếp khi gặp tin lãi suất Mỹ hoặc phát biểu của Fed.',
      },
      {
        name: 'BLS (Mỹ)',
        url: 'https://www.bls.gov/',
        provides: 'Dữ liệu giá cả, việc làm.',
        usage: 'Kiểm tra số liệu gốc CPI, việc làm trước khi dùng trong phân tích.',
      },
      {
        name: 'BEA (Mỹ)',
        url: 'https://www.bea.gov/',
        provides: 'GDP, chỉ số giá PCE.',
        usage: 'Kiểm tra số liệu gốc tăng trưởng và lạm phát PCE.',
      },
      {
        name: 'FRED — St. Louis Fed',
        url: 'https://fred.stlouisfed.org/',
        provides: 'Kho dữ liệu kinh tế: lạm phát, thất nghiệp, GDP, lãi suất.',
        usage: 'Xem xu hướng nhiều kỳ; kiểm tra nguồn, đơn vị, tần suất từng chuỗi.',
      },
    ],
  },
  {
    id: 'analysis',
    title: '📊 Phân tích có tác giả',
    sources: [
      {
        name: 'ING THINK — FX',
        url: 'https://think.ing.com/category/fx/',
        provides: 'Phân tích ngoại hối của đội ngũ chiến lược gia ING (FX Daily, FX Talking).',
        usage: 'Tham khảo cách dựng lập luận vĩ mô; xem dự báo là kịch bản cần kiểm chứng.',
      },
      {
        name: 'TradingView — Forex',
        url: 'https://www.tradingview.com/markets/currencies/',
        provides: 'Biểu đồ, tỷ giá, tin tức, ý tưởng giao dịch của người dùng.',
        usage: 'Quan sát giá, ghi kịch bản của mình. Đánh giá riêng chất lượng từng tác giả mục Ideas.',
      },
      {
        name: 'BabyPips — School of Pipsology',
        url: 'https://www.babypips.com/learn/forex',
        provides: 'Chương trình học forex, phân tích, kế hoạch giao dịch, nhật ký, quản trị rủi ro.',
        usage: 'Hệ thống hóa kiến thức, tìm phần còn thiếu.',
      },
    ],
  },
  {
    id: 'expectations',
    title: '📈 Kỳ vọng thị trường',
    sources: [
      {
        name: 'CME FedWatch',
        url: 'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html',
        provides: 'Xác suất các mức lãi suất Fed suy từ giá hợp đồng tương lai Fed Funds.',
        usage: 'Đây là kỳ vọng phản ánh trong giá thị trường, KHÔNG phải quyết định đã công bố.',
      },
      {
        name: 'CFTC — Commitments of Traders',
        url: 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm',
        provides: 'Cơ cấu vị thế trên thị trường hợp đồng tương lai và quyền chọn.',
        usage: 'Dữ liệu chốt thứ Ba, công bố thứ Sáu — tính đến độ trễ khi dùng.',
      },
    ],
  },
  {
    id: 'brokers',
    title: '🛡️ Kiểm tra sàn (đối chiếu pháp nhân ký hợp đồng)',
    sources: [
      {
        name: 'FCA Firm Checker (Anh)',
        url: 'https://www.fca.org.uk/consumers/check-firm',
        provides: 'Tên pháp nhân, quyền cung cấp dịch vụ, thông tin liên hệ.',
        usage: 'Không tự xác nhận mọi trường hợp được bồi thường/bảo vệ.',
      },
      {
        name: 'FCA Warning List',
        url: 'https://www.fca.org.uk/consumers/warning-list-unauthorised-firms',
        provides: 'Cảnh báo đơn vị không được phép hoạt động tại Anh.',
        usage: 'Không xuất hiện trong danh sách CHƯA đủ kết luận đáng tin.',
      },
      {
        name: 'NFA BASIC (Mỹ)',
        url: 'https://www.nfa.futures.org/basicnet/',
        provides: 'Thông tin đăng ký, hồ sơ tổ chức/cá nhân ngành phái sinh.',
        usage: 'Tra cứu trước khi nạp tiền. Đọc thêm hướng dẫn rủi ro forex của CFTC khi dùng đòn bẩy.',
      },
    ],
  },
];

/** Lưu ý pháp lý VN (có mốc thời gian — không suy diễn quá mốc). */
export const VN_REGULATORY_NOTE =
  'Việt Nam: bài VnExpress 07/05/2025 dẫn báo cáo NHNN — tại thời điểm đó NHNN chưa cấp phép sàn forex nào, ' +
  'chuyển tiền ra nước ngoài cho giao dịch forex không được phép theo quy định được dẫn. ' +
  'Thông tin có mốc thời gian, chưa xác minh thay đổi pháp lý sau mốc này. ' +
  'Ngày 25/09/2026, FCA cảnh báo một số doanh nghiệp dùng giấy phép tại Anh để tạo uy tín ' +
  'cho công ty liên kết ở nước ngoài — cần kiểm tra đúng pháp nhân ký hợp đồng.';

/**
 * Đoạn text nạp vào prompt của mạng nơ-ron (LLM) — liệt kê nguồn tham chiếu
 * để phân tích bám nguồn chính thống, có tác giả rõ ràng.
 */
export function referenceSourcesPrompt(): string {
  const lines: string[] = ['NGUỒN THAM CHIẾU ĐÁNG TIN (dùng để đối chiếu, nêu rõ khi trích dẫn):'];
  for (const cat of REFERENCE_SOURCES) {
    lines.push(`- ${cat.title}`);
    for (const s of cat.sources) {
      lines.push(`  • ${s.name} (${s.url}): ${s.provides} Cách dùng: ${s.usage}`);
    }
  }
  lines.push(`- Lưu ý pháp lý: ${VN_REGULATORY_NOTE}`);
  return lines.join('\n');
}
