import React, { useMemo, useState } from 'react';
import { Brain, Eye, EyeOff } from 'lucide-react';
import { Signal, MarketSnapshot } from '../types';
import { getNeuralMode, setNeuralMode, neuralStatusText } from '../lib/neural/observer';
import { queryNeuralRecords, countNeuralRecords } from '../lib/neural/repository';
import { totalScore } from '../lib/scoring';

interface NeuralPanelProps {
  signal: Signal | undefined;
  snapshot: MarketSnapshot | undefined;
  /** đổi khi có dữ liệu mới → panel đọc lại repository */
  refreshKey: number;
}

/**
 * Khu vực trạng thái neural (skill §11):
 * - Điểm quy tắc hiển thị riêng với xác suất mô hình.
 * - Chưa có model → "Chưa huấn luyện", xác suất "—", KHÔNG vẽ thanh giả.
 * - Shadow chỉ quan sát, không tham gia quyết định vào lệnh.
 */
export const NeuralPanel: React.FC<NeuralPanelProps> = ({ signal, snapshot, refreshKey }) => {
  const [mode, setMode] = useState(getNeuralMode());

  const latest = useMemo(() => {
    void refreshKey;
    if (!signal) return null;
    return queryNeuralRecords(50).find((r) => r.snapshot.instrument === signal.symbol) || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal?.symbol, refreshKey]);

  const assessment = latest?.assessment || null;
  const statusText = neuralStatusText(assessment, mode);
  const ruleScore = signal?.scoreBreakdown ? totalScore(signal.scoreBreakdown) : null;
  const missingCount = latest ? Object.keys(latest.snapshot.features.missing).length : 0;
  const totalRecords = countNeuralRecords();

  const toggle = () => {
    const next = mode === 'shadow' ? 'off' : 'shadow';
    setNeuralMode(next);
    setMode(next);
  };

  return (
    <div className="bg-[#0b0f19] p-4 rounded-lg border border-purple-900/50 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <Brain size={14} className="text-purple-400" />
          NEURAL SHADOW — QUAN SÁT THỬ
        </div>
        <button
          onClick={toggle}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
            mode === 'shadow'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              : 'bg-[#17223b] text-slate-400 border border-[#243356] hover:text-white'
          }`}
          title="Bật/tắt chế độ shadow (không ảnh hưởng tín hiệu hiện tại)"
        >
          {mode === 'shadow' ? <Eye size={13} /> : <EyeOff size={13} />}
          {mode === 'shadow' ? 'SHADOW: BẬT' : 'ĐÃ TẮT'}
        </button>
      </div>

      {mode === 'off' ? (
        <div className="text-[11px] text-slate-500">
          Mô-đun neural đang tắt. Tín hiệu quy tắc hoạt động bình thường, không có gì bị ghi thêm.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
            <div className="bg-[#131b2e] p-2.5 rounded border border-[#1e2b48]">
              <div className="text-[10px] text-slate-400">TRẠNG THÁI ĐÁNH GIÁ</div>
              <div className="font-bold text-amber-400">{statusText}</div>
            </div>
            <div className="bg-[#131b2e] p-2.5 rounded border border-[#1e2b48]">
              <div className="text-[10px] text-slate-400">ĐIỂM QUY TẮC</div>
              <div className="font-bold text-slate-200">{ruleScore !== null ? `${ruleScore}/100` : '—'}</div>
            </div>
            <div className="bg-[#131b2e] p-2.5 rounded border border-[#1e2b48]">
              <div className="text-[10px] text-slate-400">XÁC SUẤT MÔ HÌNH</div>
              <div className="font-bold text-slate-500">— <span className="font-sans font-normal text-[10px]">(chưa huấn luyện)</span></div>
            </div>
            <div className="bg-[#131b2e] p-2.5 rounded border border-[#1e2b48]">
              <div className="text-[10px] text-slate-400">BẢN GHI SHADOW</div>
              <div className="font-bold text-purple-300">{totalRecords}</div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 space-y-1 font-mono">
            <div>
              Dữ liệu: <span className="text-slate-200">{latest?.snapshot.provenance.source || snapshot?.dataSource || '—'}</span>
              {' · '}as_of <span className="text-slate-200">{latest?.snapshot.asOf.slice(11, 19) || '—'} UTC</span>
              {' · '}độ trễ <span className="text-slate-200">{latest?.assessment.latencyMs ?? '—'} ms</span>
            </div>
            <div>
              Features: <span className="text-emerald-400">{latest ? Object.keys(latest.snapshot.features.values).filter((k) => latest.snapshot.features.values[k] !== null).length : 0} OK</span>
              {missingCount > 0 && <span className="text-amber-400"> · {missingCount} thiếu ({Object.keys(latest!.snapshot.features.missing).join(', ')})</span>}
            </div>
            {assessment && assessment.reasonCodes.length > 0 && (
              <div>
                Lý do: <span className="text-slate-300">{assessment.reasonCodes.join(', ')}</span>
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-500 border-t border-[#1e2b48] pt-2">
            Shadow chỉ quan sát và ghi nhật ký — không tham gia quyết định vào lệnh, không gọi order router.
            {latest && <span> Snapshot <span className="font-mono">{latest.snapshot.setupId.slice(0, 40)}…</span> bất biến.</span>}
          </div>
        </>
      )}
    </div>
  );
};
