import React from 'react';
import { HelpCircle, Keyboard, CheckSquare } from 'lucide-react';

export const HelpTab: React.FC = () => {
  const shortcuts = [
    { key: 'F', desc: 'Mở tab FLIGHT (Tín hiệu & Nút 1-Click BUY/SELL)' },
    { key: 'X', desc: 'Mở tab CTX (Bối cảnh thị trường MTF & Sức mạnh tiền tệ)' },
    { key: 'S', desc: 'Mở tab SIG (Quản lý Engines & Dòng chẩn đoán bị chặn)' },
    { key: 'D', desc: 'Mở tab RADAR (Bảng quét đa tài sản & Chuyển cặp tiền)' },
    { key: 'N', desc: 'Mở tab NEWS (Lịch kinh tế & Cửa sổ tin tức đỏ)' },
    { key: 'L', desc: 'Mở tab LOG (Thống kê hiệu suất & Xuất báo cáo)' },
    { key: 'C', desc: 'Mở tab CHART (Biểu đồ nến & marker lệnh Entry/SL/TP)' },
    { key: 'H', desc: 'Mở tab HELP (Trợ giúp nhanh)' },
    { key: 'K', desc: 'Đóng / Mở thanh Dock công cụ bên trái' },
    { key: 'M', desc: 'Thu gọn (Minimize) hoặc Mở rộng Cockpit' },
    { key: 'R', desc: 'Tải về báo cáo kiểm toán HTML ngay lập tức' }
  ];

  return (
    <div className="space-y-4">
      {/* Keyboard Shortcuts */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Keyboard size={18} className="text-sky-400" />
          <span className="font-bold text-sm text-slate-100">BẢNG PHÍM TẮT TRÊN BÀN PHÍM (HOTKEYS)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {shortcuts.map((s) => (
            <div key={s.key} className="bg-[#0b0f19] p-3 rounded-xl border border-[#1e2b48] flex items-center gap-3">
              <span className="font-mono font-bold text-xs px-2.5 py-1 rounded bg-[#17223b] text-sky-400 border border-[#243356]">
                {s.key}
              </span>
              <span className="text-xs text-slate-300">{s.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Operational Rules */}
      <div className="glass-panel p-5 space-y-3">
        <div className="flex items-center gap-2">
          <CheckSquare size={18} className="text-emerald-400" />
          <span className="font-bold text-sm text-slate-100">QUY TẮC VẬN HÀNH KỶ LUẬT HÀNG NGÀY</span>
        </div>

        <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
          <p>• <strong>Quản lý vốn nghiêm ngặt:</strong> Giữ rủi ro ở mức 0.5% – 1.0% mỗi lệnh. Sử dụng máy tính Lot (CALC) để luôn vào đúng khối lượng.</p>
          <p>• <strong>Chiến lược 3-Tier TP:</strong> Chốt 50% khối lượng tại TP1 để bỏ túi lợi nhuận; dời Stop Loss về hòa vốn (BE) để giữ giao dịch an toàn.</p>
          <p>• <strong>Tránh tin tức lớn:</strong> Tuyệt đối không vào lệnh mới trong cửa sổ tin tức đỏ (thẻ HIGH impact tại tab NEWS).</p>
          <p>• <strong>Tâm lý kiên nhẫn:</strong> Ngày không có tín hiệu là bình thường. Dòng “Bị chặn” tại tab SIG luôn cho bạn biết lý do thị trường cần nghỉ ngơi.</p>
        </div>
      </div>
    </div>
  );
};
