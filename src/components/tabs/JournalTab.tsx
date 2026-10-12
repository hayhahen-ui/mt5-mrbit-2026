import React from 'react';
import { BookMarked, Bot, Hand, Timer, Trash2 } from 'lucide-react';
import {
  Position,
  JournalEntry,
  JournalOutcome,
  AutoCloseConfig,
  TIME_STOP_OPTIONS,
} from '../../types';
import { OUTCOME_META } from '../../lib/journal';
import { fmtLocalTime } from '../../lib/time';
import { entryPnlUsd, fmtUsd } from '../../lib/account';
import { useSharedJournal } from '../../lib/useSharedJournal';
import { positionMargin } from '../../lib/positions';

interface JournalTabProps {
  positions: Position[];
  journal: JournalEntry[];
  defaultAuto: AutoCloseConfig;
  onDefaultAutoChange: (cfg: AutoCloseConfig) => void;
  onUpdateAuto: (id: string, patch: Partial<AutoCloseConfig>) => void;
  onCloseWithOutcome: (id: string, outcome: JournalOutcome) => void;
  onMoveToBE: (id: string) => void;
  onCloseAllPositions: () => void;
}

function fmtElapsed(openedAt: number | undefined): string {
  if (!openedAt) return '—';
  const s = Math.max(0, Math.floor((Date.now() - openedAt) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}h${String(m).padStart(2, '0')}m`
    : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function fmtTimeStop(min: number | null | undefined): string {
  if (!min) return 'Không';
  return min >= 60 ? `${min / 60}h` : `${min}m`;
}

/**
 * SỔ LỆNH — nhật ký giao dịch:
 * - Lệnh mở từ 1-Click được ghi ngay tại đây, kèm tùy chọn đóng TAY hoặc bot AUTO
 *   (tự chốt khi chạm TP / tự cắt khi chạm SL / time-stop 1m–1D).
 * - Lịch sử lệnh đã đóng: ghi rõ đóng tay hay bot tự đóng.
 */
export const JournalTab: React.FC<JournalTabProps> = ({
  positions,
  journal,
  defaultAuto,
  onDefaultAutoChange,
  onUpdateAuto,
  onCloseWithOutcome,
  onMoveToBE,
  onCloseAllPositions,
}) => {
  const totalPnl = positions.reduce((a, p) => a + (p.pnl || 0), 0);
  const totalInvest = positions.reduce((a, p) => a + positionMargin(p), 0);
  const totalEquity = totalInvest + totalPnl;
  const { group: sharedGroup, sharedOpens, sharedTrades } = useSharedJournal();

  const timeStopSelect = (
    value: number | null | undefined,
    onChange: (v: number | null) => void,
    small = false
  ) => (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className={`bg-[#17223b] border border-[#243356] rounded-lg text-slate-200 font-mono focus:outline-none focus:border-sky-500/60 ${
        small ? 'text-[10px] px-1 py-1' : 'text-[11px] px-2 py-1.5'
      }`}
      title="Time-stop: tự đóng lệnh sau khoảng thời gian này nếu chưa chạm TP/SL"
    >
      <option value="">Không</option>
      {TIME_STOP_OPTIONS.map((o) => (
        <option key={o.minutes} value={o.minutes}>
          {o.label}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-4">
      {/* Cấu hình mặc định cho lệnh mới */}
      <div className="glass-panel p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <BookMarked size={16} className="text-amber-400" />
            SỔ LỆNH — NHẬT KÝ GIAO DỊCH
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Lệnh từ nút 1-Click được ghi ngay tại đây. Chọn <b className="text-slate-200">đóng tay</b> hoặc để{' '}
            <b className="text-slate-200">bot tự đóng</b> khi chạm TP/SL / hết time-stop.
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <span className="text-slate-400 font-bold">Mặc định lệnh mới:</span>
          <div className="flex rounded-lg overflow-hidden border border-[#243356]">
            <button
              onClick={() => onDefaultAutoChange({ ...defaultAuto, mode: 'MANUAL' })}
              className={`px-3 py-1.5 font-bold flex items-center gap-1.5 ${
                defaultAuto.mode === 'MANUAL'
                  ? 'bg-slate-600 text-white'
                  : 'bg-[#0b0f19] text-slate-400 hover:text-slate-200'
              }`}
            >
              <Hand size={12} /> TAY
            </button>
            <button
              onClick={() => onDefaultAutoChange({ ...defaultAuto, mode: 'AUTO' })}
              className={`px-3 py-1.5 font-bold flex items-center gap-1.5 ${
                defaultAuto.mode === 'AUTO'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#0b0f19] text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bot size={12} /> AUTO
            </button>
          </div>
          {defaultAuto.mode === 'AUTO' && (
            <>
              <label className="flex items-center gap-1.5 text-slate-300 font-mono cursor-pointer">
                <input
                  type="checkbox"
                  checked={defaultAuto.tp}
                  onChange={(e) => onDefaultAutoChange({ ...defaultAuto, tp: e.target.checked })}
                  className="accent-emerald-500"
                />
                TP
              </label>
              <label className="flex items-center gap-1.5 text-slate-300 font-mono cursor-pointer">
                <input
                  type="checkbox"
                  checked={defaultAuto.sl}
                  onChange={(e) => onDefaultAutoChange({ ...defaultAuto, sl: e.target.checked })}
                  className="accent-rose-500"
                />
                SL
              </label>
              <span className="flex items-center gap-1.5 text-slate-400">
                <Timer size={13} />
                {timeStopSelect(defaultAuto.timeStopMin, (v) =>
                  onDefaultAutoChange({ ...defaultAuto, timeStopMin: v })
                )}
              </span>
              <label className="flex items-center gap-1 text-emerald-300 font-mono" title="Ăn non: lời đạt $ này → tự đóng ngay">
                🤑 +$
                <input
                  type="number" min={0} step={1} placeholder="5"
                  value={defaultAuto.tpUsd ?? ''}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    onDefaultAutoChange({ ...defaultAuto, tpUsd: v > 0 ? v : null });
                  }}
                  className="w-14 px-1.5 py-1 rounded bg-[#0b0f19] border border-emerald-500/30 text-emerald-200 text-[11px] font-mono"
                />
              </label>
              <label className="flex items-center gap-1 text-rose-300 font-mono" title="Cắt lỗ sớm: lỗ đạt $ này → tự đóng ngay">
                😱 -$
                <input
                  type="number" min={0} step={1} placeholder="5"
                  value={defaultAuto.slUsd ?? ''}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    onDefaultAutoChange({ ...defaultAuto, slUsd: v > 0 ? v : null });
                  }}
                  className="w-14 px-1.5 py-1 rounded bg-[#0b0f19] border border-rose-500/30 text-rose-200 text-[11px] font-mono"
                />
              </label>
            </>
          )}
        </div>
      </div>

      {/* Lệnh đang mở */}
      <div className="glass-panel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-slate-200">
            VỊ THẾ ĐANG MỞ <span className="text-slate-400 font-mono">({positions.length})</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-sky-300">
                💰 Đầu tư: <strong>${totalInvest.toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong>
              </span>
              <span className={totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                📈 Lãi/Lỗ: <strong>{totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}</strong>
              </span>
              <span className="text-amber-300">
                💎 Thực có: <strong>${totalEquity.toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong>
              </span>
            </div>
            {positions.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('Đóng toàn bộ vị thế đang mở (giá hiện tại)?')) onCloseAllPositions();
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/40 text-rose-400 text-[11px] font-bold flex items-center gap-1.5 hover:bg-rose-600/30"
              >
                <Trash2 size={12} /> ĐÓNG TẤT CẢ
              </button>
            )}
          </div>
        </div>

        {positions.length === 0 ? (
          <div className="text-xs text-slate-500 bg-[#0b0f19] p-4 rounded-lg border border-[#1e2b48] text-center">
            Chưa có lệnh nào đang mở. Vào tab FLIGHT → bấm 1-Click để mở lệnh, lệnh sẽ ghi ngay vào đây.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#1e2b48] text-slate-400 font-mono">
                  <th className="py-2">Mã lệnh</th>
                  <th>Cặp</th>
                  <th>Chiều</th>
                  <th className="text-right">Lot</th>
                  <th className="text-right" title="Margin = vốn ký quỹ bỏ ra (đòn bẩy 1:100)">Đầu tư</th>
                  <th className="text-right">Giá vào</th>
                  <th className="text-right">Hiện tại</th>
                  <th className="text-right">SL / TP</th>
                  <th className="text-right">Lãi/Lỗ</th>
                  <th className="text-right">Đã mở</th>
                  <th>Chế độ đóng</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2b48] font-mono">
                {positions.map((p) => {
                  const ac: AutoCloseConfig = p.autoClose || defaultAuto;
                  const isAuto = ac.mode === 'AUTO';
                  return (
                    <tr key={p.id} className="hover:bg-[#17223b]/40 align-top">
                      <td className="py-2 text-slate-500 text-[10px]">{p.id}</td>
                      <td className="font-bold text-slate-200">{p.symbol}</td>
                      <td className={p.type === 'BUY' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {p.type} <span className="text-slate-500">({p.tier})</span>
                      </td>
                      <td className="text-right">{p.lot}</td>
                      <td className="text-right text-sky-300">${positionMargin(p).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td className="text-right">{p.entryPrice}</td>
                      <td className="text-right text-sky-300">{p.currentPrice}</td>
                      <td className="text-right text-[11px]">
                        <span className="text-rose-400">{p.sl}</span>
                        <span className="text-slate-500"> / </span>
                        <span className="text-emerald-400">{p.tp}</span>
                      </td>
                      <td className={`text-right font-bold ${p.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)}
                        <div className="text-[10px] font-normal">({p.pips >= 0 ? '+' : ''}{p.pips}p)</div>
                      </td>
                      <td className="text-right text-slate-400">{fmtElapsed(p.openedAt)}</td>
                      <td>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="flex rounded-md overflow-hidden border border-[#243356]">
                            <button
                              title="Đóng tay — bot không tự can thiệp"
                              onClick={() => onUpdateAuto(p.id, { mode: 'MANUAL' })}
                              className={`px-2 py-1 text-[10px] font-bold ${
                                !isAuto ? 'bg-slate-600 text-white' : 'bg-[#0b0f19] text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              TAY
                            </button>
                            <button
                              title="Bot tự đóng khi chạm TP/SL hoặc hết time-stop"
                              onClick={() => onUpdateAuto(p.id, { mode: 'AUTO' })}
                              className={`px-2 py-1 text-[10px] font-bold ${
                                isAuto ? 'bg-emerald-600 text-white' : 'bg-[#0b0f19] text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              AUTO
                            </button>
                          </div>
                          {isAuto && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                              <label className="flex items-center gap-0.5 cursor-pointer" title="Tự chốt khi chạm TP">
                                <input
                                  type="checkbox"
                                  checked={ac.tp}
                                  onChange={(e) => onUpdateAuto(p.id, { tp: e.target.checked })}
                                  className="accent-emerald-500"
                                />
                                TP
                              </label>
                              <label className="flex items-center gap-0.5 cursor-pointer" title="Tự cắt khi chạm SL">
                                <input
                                  type="checkbox"
                                  checked={ac.sl}
                                  onChange={(e) => onUpdateAuto(p.id, { sl: e.target.checked })}
                                  className="accent-rose-500"
                                />
                                SL
                              </label>
                              <span title="Time-stop">
                                {timeStopSelect(ac.timeStopMin, (v) => onUpdateAuto(p.id, { timeStopMin: v }), true)}
                              </span>
                            </div>
                          )}
                        </div>
                        {isAuto && (
                          <div className="text-[10px] text-emerald-500/80 font-sans mt-0.5">
                            Bot sẽ đóng: {[ac.tp && 'chạm TP', ac.sl && 'chạm SL', ac.timeStopMin && `sau ${fmtTimeStop(ac.timeStopMin)}`].filter(Boolean).join(' · ') || '—'}
                          </div>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <button
                            onClick={() => onMoveToBE(p.id)}
                            className="px-2 py-1 rounded bg-sky-600/20 border border-sky-500/40 text-sky-400 text-[10px] font-bold hover:bg-sky-600/30"
                          >
                            DỜI BE
                          </button>
                          <button
                            onClick={() => onCloseWithOutcome(p.id, 'TP')}
                            className="px-2 py-1 rounded bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold hover:bg-emerald-600/30"
                          >
                            ✓TP
                          </button>
                          <button
                            onClick={() => onCloseWithOutcome(p.id, 'SL')}
                            className="px-2 py-1 rounded bg-rose-600/20 border border-rose-500/40 text-rose-400 text-[10px] font-bold hover:bg-rose-600/30"
                          >
                            ✗SL
                          </button>
                          <button
                            onClick={() => onCloseWithOutcome(p.id, 'BE')}
                            className="px-2 py-1 rounded bg-[#17223b] border border-[#243356] text-slate-300 text-[10px] font-bold hover:bg-[#1e2b48]"
                          >
                            =BE
                          </button>
                          <button
                            onClick={() => onCloseWithOutcome(p.id, 'MANUAL')}
                            className="px-2 py-1 rounded bg-[#17223b] border border-[#243356] text-slate-400 text-[10px] font-bold hover:bg-[#1e2b48]"
                          >
                            ĐÓNG TAY
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Vị thế đang mở từ thiết bị khác (chỉ xem) */}
      {sharedGroup && sharedOpens.length > 0 && (
        <div className="glass-panel p-5 space-y-3 border-emerald-800/40">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-emerald-300">
              📱 VỊ THẾ ĐANG MỞ — THIẾT BỊ KHÁC
            </div>
            <span className="text-xs text-slate-400 font-mono">{sharedOpens.length} vị thế · {sharedGroup}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#1e2b48] text-slate-400 font-mono">
                  <th className="py-2">Thiết bị</th><th>Mã</th><th>Chiều</th>
                  <th className="text-right">Lot</th><th className="text-right">Giá vào</th><th>Ghi chú</th><th>Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2b48] font-mono">
                {sharedOpens.map((e, i) => (
                  <tr key={`so-${i}`} className="hover:bg-[#17223b]/40 opacity-80">
                    <td className="py-2 text-sky-300 text-[11px]">📱 {e.deviceName}</td>
                    <td className="font-bold text-slate-200">{e.symbol}</td>
                    <td className={e.direction === 'BUY' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{e.direction}</td>
                    <td className="text-right">{e.lot}</td>
                    <td className="text-right">{e.entry}</td>
                    <td className="text-[11px] text-slate-500">{e.note}</td>
                    <td className="text-slate-500 text-[11px]">{new Date(e.ts).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[10px] text-slate-500 italic">Chỉ xem — không thể đóng/sửa vị thế của thiết bị khác.</div>
        </div>
      )}

      {/* Lịch sử lệnh đã đóng */}
      <div className="glass-panel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-slate-200">LỊCH SỬ LỆNH ĐÃ ĐÓNG</div>
          <span className="text-xs text-slate-400 font-mono">{journal.length} bản ghi</span>
        </div>
        {journal.length === 0 ? (
          <div className="text-xs text-slate-500 bg-[#0b0f19] p-4 rounded-lg border border-[#1e2b48] text-center">
            Chưa có lệnh nào được ghi sổ.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#1e2b48] text-slate-400 font-mono">
                  <th className="py-2">Đóng lệnh</th>
                  <th>Mã</th>
                  <th>Chiều</th>
                  <th className="text-right">Lot</th>
                  <th className="text-right">Vào</th>
                  <th className="text-right">Thoát</th>
                  <th>Kết quả</th>
                  <th>Cách đóng</th>
                  <th className="text-right">R</th>
                  <th className="text-right">Lãi/Lỗ ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2b48] font-mono">
                {[...journal].reverse().map((j) => (
                  <tr key={j.id} className="hover:bg-[#17223b]/40">
                    <td className="py-2 text-slate-400 text-[11px]">{fmtLocalTime(j.closeTime)}</td>
                    <td className="font-bold text-slate-200">{j.symbol}</td>
                    <td className={j.direction === 'BUY' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {j.direction}
                    </td>
                    <td className="text-right">{j.lot}</td>
                    <td className="text-right">{j.entryPrice}</td>
                    <td className="text-right">{j.exitPrice}</td>
                    <td className={`${OUTCOME_META[j.outcome].color} font-bold`}>{OUTCOME_META[j.outcome].label}</td>
                    <td className="text-[11px]">
                      {j.closeMethod === 'auto' ? (
                        <span className="text-emerald-400">🤖 {j.closeNote || 'bot tự đóng'}</span>
                      ) : (
                        <span className="text-slate-400">👆 đóng tay</span>
                      )}
                    </td>
                    <td className={`text-right font-bold ${j.rMultiple >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {j.rMultiple >= 0 ? '+' : ''}{j.rMultiple}R
                    </td>
                    {(() => { const usd = entryPnlUsd(j); return (
                    <td className={`text-right font-bold ${usd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {usd >= 0 ? '+' : '-'}{fmtUsd(Math.abs(usd))}
                    </td>); })()}
                  </tr>
                ))}
                {/* Lệnh đã đóng từ thiết bị khác */}
                {sharedTrades.map((e, i) => (
                  <tr key={`st-${i}`} className="hover:bg-[#17223b]/40 opacity-80 bg-emerald-950/10">
                    <td className="py-2 text-slate-400 text-[11px]">
                      {new Date(e.ts).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      <div className="text-sky-400 text-[10px]">📱 {e.deviceName}</div>
                    </td>
                    <td className="font-bold text-slate-200">{e.symbol}</td>
                    <td className={e.direction === 'BUY' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{e.direction}</td>
                    <td className="text-right">{e.lot ?? '—'}</td>
                    <td className="text-right">{e.entry ?? '—'}</td>
                    <td className="text-right">{e.exit ?? '—'}</td>
                    <td className="text-slate-400">{e.outcome || '—'}</td>
                    <td className="text-[11px] text-slate-500">thiết bị khác</td>
                    <td className={`text-right font-bold ${(e.rMultiple || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {e.rMultiple !== null && e.rMultiple !== undefined ? `${e.rMultiple >= 0 ? '+' : ''}${e.rMultiple}R` : '—'}
                    </td>
                    <td className={`text-right font-bold ${(e.pnlUsd || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {e.pnlUsd !== null && e.pnlUsd !== undefined ? `${e.pnlUsd >= 0 ? '+' : '-'}$${Math.abs(e.pnlUsd).toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
