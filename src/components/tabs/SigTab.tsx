import React, { useState } from 'react';
import { Sliders, AlertCircle, Newspaper, CheckCircle2, XCircle, Info } from 'lucide-react';
import { NewsEvent, Asset, MarketSnapshot, Signal, AccountState } from '../../types';
import { checkNewsFilter } from '../../lib/scoring';
import {
  ENGINE_IDS, ENGINE_NAMES, ENGINE_TAGS, ENGINE_DESC, EngineId,
  getEngineToggles, setEngineToggle,
} from '../../lib/engines';
import { evalSessions } from '../../lib/sessions';
import { currentSession } from '../../lib/signalEngine';

interface SigTabProps {
  newsEvents: NewsEvent[];
  selectedSymbol: string;
  asset?: Asset;
  snapshot?: MarketSnapshot;
  signal?: Signal;
  account?: AccountState;
}

interface Gate {
  id: string;
  label: string;
  /** true = đạt, false = chặn, null = chỉ thông tin */
  pass: boolean | null;
  blocking: boolean;
  detail: string;
}

/**
 * Tab SIG — chẩn đoán minh bạch + quản lý engines.
 * Mọi cổng đều tính THẬT từ dữ liệu live (không chữ tĩnh):
 * tin tức, engine bật/tắt, spread, drawdown, phiên, độ tươi dữ liệu.
 * Tắt engine ở đây → evaluateSignal chặn tín hiệu loại đó thật.
 */
export const SigTab: React.FC<SigTabProps> = ({
  newsEvents, selectedSymbol, asset, snapshot, signal, account,
}) => {
  const [toggles, setToggles] = useState<Record<EngineId, boolean>>(() => getEngineToggles());

  const toggle = (id: EngineId) => {
    setToggles(setEngineToggle(id, !toggles[id]));
  };

  // ---- 6 cổng chẩn đoán (tính live) ----
  const gates: Gate[] = [];
  const newsFilter = checkNewsFilter(selectedSymbol, newsEvents);
  gates.push({
    id: 'news', label: 'Bộ lọc tin tức', blocking: true,
    pass: !newsFilter.blocked, detail: newsFilter.reason,
  });

  const sigEngine: EngineId | undefined = signal?.engine;
  const engineBlocked = sigEngine ? toggles[sigEngine] === false : false;
  gates.push({
    id: 'engine', label: 'Engine tín hiệu', blocking: true,
    pass: engineBlocked ? false : true,
    detail: sigEngine
      ? `${ENGINE_NAMES[sigEngine]} ${toggles[sigEngine] ? 'đang BẬT' : 'đang TẮT → tín hiệu mới loại này bị chặn'}`
      : `Chưa có tín hiệu để chẩn đoán · ${ENGINE_IDS.map((e) => `${ENGINE_NAMES[e]}:${toggles[e] ? 'ON' : 'OFF'}`).join(' ')}`,
  });

  const spreadLimit = asset ? (asset.category === 'Crypto' ? 25 : 2.5) : 2.5;
  const spreadOk = asset ? asset.spread <= spreadLimit : true;
  gates.push({
    id: 'spread', label: 'Spread', blocking: true,
    pass: spreadOk,
    detail: asset ? `Spread ${asset.spread} pips (ngưỡng ${spreadLimit})` : 'Chưa có dữ liệu asset',
  });

  const dd = account?.dailyDrawdownPct ?? 0;
  const ddMax = account?.maxDailyLossPct ?? 5;
  gates.push({
    id: 'dd', label: 'Drawdown ngày', blocking: true,
    pass: dd < ddMax,
    detail: `DD hôm nay ${dd.toFixed(2)}% / giới hạn ${ddMax}%`,
  });

  const openSessions = evalSessions(new Date()).filter((s) => s.isOpen).map((s) => s.label);
  gates.push({
    id: 'session', label: 'Phiên giao dịch', blocking: false, pass: null,
    detail: snapshot?.session
      ? `Phiên lúc đánh giá: ${snapshot.session} · đang mở: ${openSessions.join(', ') || '—'}`
      : `Đang mở: ${openSessions.join(', ') || '—'} (phiên: ${currentSession()})`,
  });

  const warmup = snapshot?.warmup || asset?.warmup || '0/20';
  const src = snapshot?.dataSource || asset?.dataSource || 'OFFLINE';
  const ageMin = asset?.updatedAt ? Math.max(0, Math.round((Date.now() - asset.updatedAt) / 60000)) : null;
  gates.push({
    id: 'data', label: 'Độ tươi dữ liệu', blocking: false, pass: null,
    detail: `Warmup ${warmup} · nguồn ${src}${ageMin !== null ? ` · giá cách đây ${ageMin} phút` : ''}`,
  });

  const blockedGates = gates.filter((g) => g.blocking && g.pass === false);
  const allClear = blockedGates.length === 0;

  return (
    <div className="space-y-4">
      {/* 1. DÒNG CHẨN ĐOÁN (tính live, không chữ tĩnh) */}
      <div className={`glass-panel p-5 border-l-4 space-y-3 ${allClear ? 'border-l-emerald-500' : 'border-l-rose-500'}`}>
        <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
          <AlertCircle size={15} />
          <span>DÒNG CHẨN ĐOÁN LÝ DO "BỊ CHẶN" (TRANSPARENT DIAGNOSTICS)</span>
        </div>
        <div className="bg-[#0b0f19] p-3 rounded-lg border border-[#1e2b48] text-xs font-mono">
          <div className="text-slate-200 font-semibold flex items-center gap-1.5">
            {allClear ? <CheckCircle2 size={13} className="text-emerald-400" /> : <XCircle size={13} className="text-rose-400" />}
            Trạng thái hiện tại:{' '}
            <span className={allClear ? 'text-emerald-400' : 'text-rose-400'}>
              {allClear ? 'SẴN SÀNG — không có cổng nào chặn tín hiệu' : `BỊ CHẶN — ${blockedGates.map((g) => g.label).join(', ')}`}
            </span>
          </div>
          <div className="text-slate-400 text-[11px] mt-1">
            Chẩn đoán cho <span className="text-sky-300 font-bold">#{selectedSymbol}</span> · tính trực tiếp từ dữ liệu live lúc {new Date().toLocaleTimeString('vi-VN')}.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {gates.map((g) => (
            <div key={g.id} className="bg-[#0b0f19] p-3 rounded-lg border border-[#1e2b48] text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-200 mb-1">
                {g.pass === null ? (
                  <Info size={12} className="text-sky-400" />
                ) : g.pass ? (
                  <CheckCircle2 size={12} className="text-emerald-400" />
                ) : (
                  <XCircle size={12} className="text-rose-400" />
                )}
                {g.label.toUpperCase()}
                {g.blocking && <span className="text-[9px] font-mono text-slate-500 ml-1">[chặn tín hiệu]</span>}
              </div>
              <div className={`font-mono text-[11px] ${g.pass === false ? 'text-rose-300' : g.pass === true ? 'text-emerald-300' : 'text-slate-400'}`}>
                {g.detail}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#0b0f19] p-3 rounded-lg border border-[#1e2b48] text-xs flex items-start gap-1.5">
          <Newspaper size={13} className="text-sky-400 mt-0.5 shrink-0" />
          <div className="text-[11px] text-slate-500">
            Tin HIGH của đồng tiền liên quan trong cửa sổ tin sẽ tự động chặn tín hiệu mới.
            Tắt engine ở mục bên dưới cũng chặn tín hiệu loại đó — mọi thứ đều hiện rõ ở đây, không âm thầm.
          </div>
        </div>
      </div>

      {/* 2. QUẢN LÝ ENGINES (điều khiển thật — tắt là engine chặn tín hiệu) */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders size={18} className="text-sky-400" />
            <span className="font-bold text-sm text-slate-100">QUẢN LÝ CÁC SIGNAL ENGINES THUẬT TOÁN</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">Clean Architecture · Multi-Engine</span>
        </div>

        <div className="space-y-3">
          {ENGINE_IDS.map((id, i) => {
            const on = toggles[id];
            return (
              <div key={id} className="bg-[#0b0f19] p-4 rounded-xl border border-[#1e2b48] flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200 text-sm">{i + 1}. {ENGINE_NAMES[id]}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                      {ENGINE_TAGS[id]}
                    </span>
                    {!on && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
                        ĐANG CHẶN TÍN HIỆU
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">{ENGINE_DESC[id]}</div>
                </div>
                <button
                  onClick={() => toggle(id)}
                  className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors font-mono shrink-0 ${
                    on ? 'bg-emerald-500 text-slate-950 shadow-md' : 'bg-[#17223b] text-slate-400 hover:text-white'
                  }`}
                >
                  {on ? 'ĐANG BẬT [ON]' : 'ĐÃ TẮT [OFF]'}
                </button>
              </div>
            );
          })}
        </div>
        <div className="text-[10px] text-slate-500">
          Engine được chọn tự động mỗi lần đánh giá (RSI cực đoan → Mean Reversion · động lượng rõ → Trend · còn lại → SMC).
          Tắt engine tại đây sẽ chặn tín hiệu loại đó ngay lập tức — chẩn đoán ở trên sẽ hiện rõ.
        </div>
      </div>
    </div>
  );
};
