import React, { useEffect, useState } from 'react';
import { Download, Trash2, BookOpen, FlaskConical, RotateCcw, BarChart3 } from 'lucide-react';
import { JournalEntry } from '../../types';
import { calcJournalStats, equityCurve, OUTCOME_META } from '../../lib/journal';
import { analyzeKaizen, analyzeKaizenFull } from '../../lib/kaizen';
import { KaizenAnalysis } from '../../types';
import { fmtLocalTime } from '../../lib/time';
import { entryPnlUsd, fmtUsd, realizedPnlUsd, realizedPnlUsdClean } from '../../lib/account';
import { verifyRows, decidedStats, reconcile, dataQuality, symbolSubtotals, VerifyRow } from '../../lib/reportVerify';
import { SharedPanel } from '../SharedPanel';
import { BenchmarkPanel } from '../BenchmarkPanel';
import { KaizenEnginePanel } from '../KaizenEnginePanel';

interface LogTabProps {
  journal: JournalEntry[];
  positions?: any[];
  onClearJournal: () => void;
  onClearKaizen: () => void;
  onResetAll: () => void;
  resetMark: number | null;
}

type RangeKey = '7D' | '30D' | 'ALL';

/** Bảng "lệnh đằng sau con số" — dùng chung cho drill-down mọi thẻ metric */
const VerifyTable: React.FC<{ list: VerifyRow[]; rest: number }> = ({ list, rest }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-[11px]">
      <thead>
        <tr className="text-slate-500 text-left">
          <th className="py-1 pr-2 font-sans">Giờ đóng</th>
          <th className="pr-2 font-sans">Mã</th>
          <th className="pr-2 font-sans">Chiều</th>
          <th className="pr-2 font-sans">Kết quả</th>
          <th className="pr-2 text-right font-sans">R</th>
          <th className="pr-2 text-right font-sans">Pips*</th>
          <th className="text-right font-sans">$</th>
        </tr>
      </thead>
      <tbody>
        {list.map((r) => (
          <tr key={r.id} className="border-t border-[#1e2b48]">
            <td className="py-1 pr-2 text-slate-400 whitespace-nowrap">{fmtLocalTime(r.closeTime)}</td>
            <td className="pr-2 font-bold text-slate-200">{r.symbol}</td>
            <td className={`pr-2 ${r.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>{r.direction}</td>
            <td className="pr-2 whitespace-nowrap">
              <span className={OUTCOME_META[r.outcome].color}>{OUTCOME_META[r.outcome].label}</span>
              {r.isOutlierLot && <span className="ml-1 text-amber-400" title="Đã loại khỏi tổng $">⚠lot</span>}
            </td>
            <td className={`pr-2 text-right ${r.rMultiple >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {r.rMultiple >= 0 ? '+' : ''}{r.rMultiple}
            </td>
            <td className="pr-2 text-right text-slate-300">{r.pips >= 0 ? '+' : ''}{r.pips}</td>
            <td className={`text-right whitespace-nowrap ${r.pnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {r.pnlUsd >= 0 ? '+' : '-'}{fmtUsd(Math.abs(r.pnlUsd))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    {rest > 0 && <div className="text-slate-500 pt-1 font-sans">…còn {rest} lệnh nữa trong tập này</div>}
    {list.length === 0 && <div className="text-slate-500 font-sans">Không có lệnh nào trong tập này.</div>}
    <div className="text-[10px] text-slate-600 pt-1 font-sans">*Pips = tính lại từ giá vào/ra (tự chữa bản ghi cũ), không phải cột pips thô đã lưu.</div>
  </div>
);

export const LogTab: React.FC<LogTabProps> = ({ journal, positions = [], onClearJournal, onClearKaizen, onResetAll, resetMark }) => {
  const [range, setRange] = useState<RangeKey>('ALL');
  const stats = calcJournalStats(journal);
  const curve = equityCurve(journal);

  // REPORT theo khoảng thời gian (kiểu EA Autopilot: 7D / 30D / ALL)
  const cutoff = range === 'ALL' ? 0 : Date.now() - (range === '7D' ? 7 : 30) * 86400000;
  const fj = journal.filter((j) => new Date(j.closeTime).getTime() >= cutoff);
  const fs = calcJournalStats(fj);
  // LÃI/LỖ ($) dùng tổng đã loại outlier lot (audit 16/10/2026: 1 lệnh lot 7.58 đảo dấu tổng $)
  const pnlClean = realizedPnlUsdClean(fj);
  const totalUsd = pnlClean.total;
  const rawUsd = realizedPnlUsd(fj);

  // REPORT kiểm chứng được (audit 16/10/2026): mở rộng từng thẻ để thấy công thức + lệnh đằng sau
  const [openCard, setOpenCard] = useState<null | 'signals' | 'win' | 'pips' | 'avgR' | 'usd'>(null);
  const [symFilter, setSymFilter] = useState<string | null>(null);
  const rows = React.useMemo(() => verifyRows(fj), [fj]);
  const recon = React.useMemo(() => reconcile(fj), [fj]);
  const dq = React.useMemo(() => dataQuality(fj), [fj]);
  const subs = React.useMemo(() => symbolSubtotals(fj), [fj]);
  const toggleCard = (k: NonNullable<typeof openCard>) => setOpenCard(openCard === k ? null : k);
  const toggleSymFilter = (s: string) => {
    setSymFilter(symFilter === s ? null : s);
    if (symFilter !== s) setOpenCard('signals'); // bấm mã → mở ngay danh sách lệnh đã lọc
  };

  const byQ = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'].map((q) => {
    const es = fj.filter((j) => j.quality === q);
    const d = decidedStats(es);
    return {
      q,
      n: es.length,
      wins: d.wins,
      decided: d.decided,
      win: d.winPct,
      r: Number(es.reduce((a, e) => a + e.rMultiple, 0).toFixed(2)),
    };
  });
  const maxQ = Math.max(1, ...byQ.map((b) => b.n));

  const bySym = [...new Set(fj.map((j) => j.symbol))]
    .map((s) => {
      const es = fj.filter((j) => j.symbol === s);
      const d = decidedStats(es);
      return {
        s,
        n: es.length,
        wins: d.wins,
        decided: d.decided,
        win: d.winPct,
        r: Number(es.reduce((a, e) => a + e.rMultiple, 0).toFixed(2)),
      };
    })
    .sort((a, b) => b.n - a.n);
  const resetMarkTxt = resetMark
    ? new Date(resetMark).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    : null;
  // Phân tích Kaizen trên TOÀN BỘ lịch sử (nóng + IndexedDB); khởi đầu dùng cache nóng cho nhanh
  const [kaizen, setKaizen] = useState<KaizenAnalysis>(() => analyzeKaizen());
  useEffect(() => {
    let alive = true;
    analyzeKaizenFull().then((full) => { if (alive) setKaizen(full); }).catch(() => { /* giữ cache nóng */ });
    return () => { alive = false; };
  }, []);

  const handleDownloadReport = () => {
    const rows = journal
      .map(
        (j) =>
          `<tr><td>${fmtLocalTime(j.closeTime)}</td><td>${j.symbol}</td><td>${j.direction}</td><td>${j.engineName}</td><td>${j.tier}</td><td>${j.lot}</td><td>${j.entryPrice}</td><td>${j.exitPrice}</td><td>${OUTCOME_META[j.outcome].label}</td><td>${j.rMultiple >= 0 ? '+' : ''}${j.rMultiple}R</td><td>${(() => { const u = entryPnlUsd(j); return (u >= 0 ? '+' : '-') + fmtUsd(Math.abs(u)); })()}</td></tr>`
      )
      .join('');
    const reportHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>NexusPilot Performance Audit</title></head>
<body style="font-family:sans-serif;background:#0b0f19;color:#f1f5f9;padding:24px;">
<h1>✈️ NEXUSPILOT PRO — BÁO CÁO SỔ TÍN HIỆU</h1>
<p>Tổng lệnh: ${stats.total} | Thắng: ${stats.wins} | Thua: ${stats.losses} | Hòa vốn: ${stats.breakEvens}</p>
<p>Win Rate: ${stats.winRate}% | Tổng R: ${stats.totalR >= 0 ? '+' : ''}${stats.totalR}R | Avg R: ${stats.avgR} | Profit Factor: ${stats.profitFactor}</p>
<table border="1" cellpadding="6" style="border-collapse:collapse;font-size:12px;">
<tr><th>Đóng lệnh</th><th>Mã</th><th>Chiều</th><th>Engine</th><th>Tầng</th><th>Lot</th><th>Vào</th><th>Thoát</th><th>Kết quả</th><th>R</th><th>Lãi/Lỗ ($)</th></tr>
${rows}
</table>
<p style="color:#94a3b8;font-size:12px;">Generated by NexusPilot Web Engine — dữ liệu sổ tín hiệu local của người dùng.</p>
</body>
</html>`;
    const blob = new Blob([reportHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'NexusPilot_So_Tin_Hieu.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Điểm vẽ đường cong equity (SVG 600x150)
  const maxY = Math.max(1, ...curve.map((p) => Math.abs(p.y)));
  const points = curve
    .map((p, i) => {
      const x = curve.length === 1 ? 300 : 10 + (i / (curve.length - 1)) * 580;
      const y = 75 - (p.y / maxY) * 60;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="space-y-4">
      <SharedPanel journal={journal} positions={positions} />
      {/* REPORT — bộ lọc + 4 thẻ kiểu EA Autopilot */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <BarChart3 size={16} className="text-sky-400" />
            REPORT — HIỆU SUẤT GIAO DỊCH
          </div>
          <div className="flex gap-1.5">
            {(['7D', '30D', 'ALL'] as RangeKey[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all ${
                  range === r
                    ? 'bg-sky-500/20 border-sky-500/60 text-sky-300'
                    : 'bg-[#0b0f19] border-[#1e2b48] text-slate-400 hover:text-slate-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 font-mono">
          <div className="bg-[#0b0f19] p-4 rounded-xl border border-[#1e2b48] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">SIGNALS</span>
              <button onClick={() => toggleCard('signals')} title="Xem công thức + từng lệnh đằng sau con số" className="text-[10px] text-sky-500/70 hover:text-sky-300 font-sans">🔍</button>
            </div>
            <div className="text-2xl font-bold text-slate-100">{fs.total}</div>
            <div className="text-[10px] text-slate-500 font-sans">lệnh đã đóng sổ</div>
          </div>
          <div className="bg-[#0b0f19] p-4 rounded-xl border border-[#1e2b48] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">WIN</span>
              <button onClick={() => toggleCard('win')} title="Xem công thức + từng lệnh đằng sau con số" className="text-[10px] text-sky-500/70 hover:text-sky-300 font-sans">🔍</button>
            </div>
            <div className="text-2xl font-bold text-rose-400">{fs.winRate}%</div>
            <div className="text-[10px] text-slate-500 font-sans">{fs.wins} thắng / {fs.losses} thua · WR trên {fs.wins + fs.losses} lệnh TP/SL</div>
            {(fs.timeStops + fs.manualCloses) > 0 && (
              <div className="text-[10px] text-slate-600 font-sans">{fs.timeStops + fs.manualCloses} lệnh TIME/tay không tính WR</div>
            )}
          </div>
          <div className="bg-[#0b0f19] p-4 rounded-xl border border-[#1e2b48] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">PIPS</span>
              <button onClick={() => toggleCard('pips')} title="Xem công thức + từng lệnh đằng sau con số" className="text-[10px] text-sky-500/70 hover:text-sky-300 font-sans">🔍</button>
            </div>
            <div className={`text-2xl font-bold ${fs.totalPips >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fs.totalPips >= 0 ? '+' : ''}{fs.totalPips}
            </div>
            <div className="text-[10px] text-slate-500 font-sans">tổng pips tích lũy</div>
          </div>
          <div className="bg-[#0b0f19] p-4 rounded-xl border border-[#1e2b48] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">AVG R</span>
              <button onClick={() => toggleCard('avgR')} title="Xem công thức + từng lệnh đằng sau con số" className="text-[10px] text-sky-500/70 hover:text-sky-300 font-sans">🔍</button>
            </div>
            <div className={`text-2xl font-bold ${fs.avgR >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fs.avgR >= 0 ? '+' : ''}{fs.avgR}
            </div>
            <div className="text-[10px] text-slate-500 font-sans">Tổng {fs.totalR >= 0 ? '+' : ''}{fs.totalR}R · PF {fs.profitFactor}</div>
          </div>
          <div className="bg-[#0b0f19] p-4 rounded-xl border border-emerald-800/60 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">LÃI/LỖ ($)</span>
              <button onClick={() => toggleCard('usd')} title="Xem công thức + từng lệnh đằng sau con số" className="text-[10px] text-sky-500/70 hover:text-sky-300 font-sans">🔍</button>
            </div>
            <div className={`text-2xl font-bold ${totalUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalUsd >= 0 ? '+' : '-'}{fmtUsd(Math.abs(totalUsd))}
            </div>
            <div className="text-[10px] text-slate-500 font-sans">
              tổng tiền đã thực hiện ({range}){pnlClean.excludedCount > 0 ? ` · đã loại ${pnlClean.excludedCount} outlier lot` : ''}
            </div>
          </div>
        </div>

        {/* DRILL-DOWN kiểm chứng — công thức + từng lệnh đằng sau con số */}
        {openCard && (
          <div className="bg-[#0b0f19] rounded-xl border border-sky-800/50 p-4 space-y-3 font-mono">
            {(() => {
              const decided = fs.wins + fs.losses;
              const base = openCard === 'win'
                ? rows.filter((r) => r.outcome === 'TP' || r.outcome === 'SL')
                : rows;
              const filtered = symFilter ? base.filter((r) => r.symbol === symFilter) : base;
              const list = filtered.slice(0, 20);
              const rest = Math.max(0, filtered.length - 20);
              const sub = (label: string, val: string) => (
                <div className="text-[11px]">
                  <span className="text-slate-500 font-sans">{label}: </span>
                  <span className="text-slate-200">{val}</span>
                </div>
              );
              const perSym = (fmt: (s: (typeof subs)[number]) => string) => subs.map((s) => fmt(s)).join(' · ');
              const titles: Record<string, string> = {
                signals: 'SIGNALS — LỆNH ĐÃ ĐÓNG SỔ',
                win: 'WIN — TỶ LỆ THẮNG',
                pips: 'PIPS — TỔNG PIPS TÍCH LŨY',
                avgR: 'AVG R — R TRUNG BÌNH',
                usd: 'LÃI/LỖ ($) — TIỀN ĐÃ THỰC HIỆN',
              };
              return (
                <>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-[12px] font-bold text-sky-300">🔍 KIỂM CHỨNG — {titles[openCard]}</div>
                    <div className="flex items-center gap-2">
                      {symFilter && (
                        <button
                          onClick={() => setSymFilter(null)}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/50 text-sky-300 font-sans"
                        >
                          Lọc mã: {symFilter} ✕
                        </button>
                      )}
                      <button onClick={() => setOpenCard(null)} className="text-[10px] text-slate-500 hover:text-slate-300 font-sans">
                        đóng ✕
                      </button>
                    </div>
                  </div>
                  {openCard === 'signals' && (
                    <>
                      {sub('Công thức', `SIGNALS = đếm lệnh đã đóng sổ trong ${range} = ${fj.length}`)}
                      {sub('Đầu vào', `TP ${fs.wins} · SL ${fs.losses} · BE ${fs.breakEvens} · TIME ${fs.timeStops} · MANUAL ${fs.manualCloses}`)}
                    </>
                  )}
                  {openCard === 'win' && (
                    <>
                      {sub('Công thức', `WR = ${fs.wins} TP ÷ ${decided} lệnh TP+SL = ${fs.winRate}%`)}
                      {sub('Loại trừ', `BE ${fs.breakEvens} (hòa vốn) · TIME ${fs.timeStops} + MANUAL ${fs.manualCloses} (thoát chủ động, không phản ánh chất lượng tín hiệu)`)}
                      <div className="text-[10px] text-slate-500 font-sans">Bảng dưới chỉ hiện {decided} lệnh TP/SL — đúng tập dùng tính WR.</div>
                    </>
                  )}
                  {openCard === 'pips' && (
                    <>
                      {sub('Công thức', `PIPS = Σ pipsOf(lệnh) = ${fs.totalPips >= 0 ? '+' : ''}${fs.totalPips}`)}
                      {sub('Tự chữa', `${dq.pipsHealed} bản ghi cũ có pips lưu sai (bug hardcode pipSize) — đã tính lại từ giá vào/ra`)}
                      {sub('Theo mã', perSym((s) => `${s.symbol}: ${s.totalPips >= 0 ? '+' : ''}${s.totalPips} (${s.n} lệnh)`))}
                    </>
                  )}
                  {openCard === 'avgR' && (
                    <>
                      {sub('Công thức', `AVG R = ${fs.totalR}R ÷ ${fs.total} lệnh = ${fs.avgR} · PF ${fs.profitFactor}`)}
                      {sub('Theo mã', perSym((s) => `${s.symbol}: ${s.totalR >= 0 ? '+' : ''}${s.totalR}R (${s.n} lệnh)`))}
                    </>
                  )}
                  {openCard === 'usd' && (
                    <>
                      {sub('Công thức', `$ = Σ entryPnlUsd = ${fmtUsd(rawUsd)} (thô) − ${fmtUsd(pnlClean.excludedUsd)} (${pnlClean.excludedCount} outlier lot) = ${fmtUsd(totalUsd)}`)}
                      {sub('Theo mã', perSym((s) => `${s.symbol}: ${s.totalUsd >= 0 ? '+' : ''}${fmtUsd(s.totalUsd)} (${s.n} lệnh)`))}
                      <div className="text-[10px] text-slate-500 font-sans">Outlier = lot gấp 10 lần trung vị — đã loại khỏi tổng, đánh dấu ⚠lot dưới bảng.</div>
                    </>
                  )}
                  <VerifyTable list={list} rest={rest} />
                </>
              );
            })()}
          </div>
        )}

        {/* ĐỐI CHIẾU — tổng theo mã cộng lại vs số trên thẻ */}
        <div className="bg-[#0b0f19] rounded-xl border border-[#1e2b48] p-3 font-mono">
          <div className="text-[11px] font-bold text-teal-300 mb-2">
            🔎 ĐỐI CHIẾU — tổng theo mã cộng lại{' '}
            {recon.every((r) => r.ok) ? (
              <span className="text-emerald-400">✓ KHỚP</span>
            ) : (
              <span className="text-rose-400">✗ LỆCH — báo ngay cho em</span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
            {recon.map((r) => (
              <div key={r.key} className={`p-2 rounded-lg border ${r.ok ? 'border-emerald-800/50' : 'border-rose-700'}`}>
                <div className="text-slate-400 font-sans">
                  {r.ok ? '✓' : '✗'} {r.label}
                </div>
                <div className={r.ok ? 'text-slate-200' : 'text-rose-400 font-bold'}>
                  {r.bySymbol} = {r.total}
                  {!r.ok && (
                    <span> (lệch {r.diff > 0 ? '+' : ''}{r.diff})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BY Q — hiệu suất theo hạng tín hiệu */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-purple-400 font-mono">BY Q — THEO HẠNG TÍN HIỆU</div>
          <div className="grid grid-cols-5 gap-2">
            {byQ.map((b) => (
              <div key={b.q} className="bg-[#0b0f19] rounded-xl border border-[#1e2b48] p-2.5 text-center space-y-1">
                <div className="text-[11px] font-mono font-bold text-slate-300">{b.q}</div>
                <div className="h-1.5 bg-[#17223b] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${b.win >= 50 ? 'bg-emerald-400' : b.win >= 30 ? 'bg-amber-400' : 'bg-rose-500'}`}
                    style={{ width: `${(b.n / maxQ) * 100}%` }}
                  />
                </div>
                <div className="text-[10px] font-mono text-slate-400">{b.n} lệnh · {b.win}% ({b.wins}/{b.decided})</div>
                <div className={`text-[11px] font-mono font-bold ${b.r >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {b.r >= 0 ? '+' : ''}{b.r}R
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RADAR — hiệu suất theo mã (bấm vào một mã để lọc danh sách lệnh) */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-amber-400 font-mono">RADAR — THEO MÃ ({range}) <span className="text-slate-500 font-sans font-normal">· bấm vào mã để lọc lệnh</span></div>
          {bySym.length === 0 ? (
            <div className="text-xs text-slate-500 bg-[#0b0f19] p-3 rounded-lg border border-[#1e2b48] text-center">
              Chưa có lệnh trong khoảng này.
            </div>
          ) : (
            <div className="space-y-1.5">
              {bySym.map((b) => (
                <div
                  key={b.s}
                  onClick={() => toggleSymFilter(b.s)}
                  title="Bấm để lọc danh sách lệnh theo mã này (bấm lại để tắt)"
                  className={`flex items-center gap-3 text-xs font-mono cursor-pointer rounded-lg px-2 py-1 transition-colors ${symFilter === b.s ? 'bg-sky-500/10 border border-sky-500/50' : 'border border-transparent hover:bg-[#0b0f19]'}`}
                >
                  <span className="w-20 font-bold text-slate-200">{b.s}{symFilter === b.s ? ' ✕' : ''}</span>
                  <div className="flex-1 h-2 bg-[#17223b] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${b.win >= 50 ? 'bg-emerald-400' : b.win >= 30 ? 'bg-amber-400' : 'bg-rose-500'}`}
                      style={{ width: `${b.win}%` }}
                    />
                  </div>
                  <span className="w-48 text-right text-slate-400 text-[11px]">
                    {b.n} lệnh · {b.win}% ({b.wins}/{b.decided})
                  </span>
                  <span className={`w-20 text-right font-bold ${b.r >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {b.r >= 0 ? '+' : ''}{b.r}R
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CHẤT LƯỢNG DỮ LIỆU — đếm vấn đề bản ghi, không sửa gì */}
        <div className="bg-[#0b0f19] rounded-xl border border-[#1e2b48] p-3 font-mono">
          <div className="text-[11px] font-bold text-amber-300 mb-2">🧪 CHẤT LƯỢNG DỮ LIỆU ({range} — {dq.total} lệnh)</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
            <div className={`p-2 rounded-lg border ${dq.missingPrices === 0 ? 'border-emerald-800/50' : 'border-amber-600'}`}>
              <div className="text-slate-400 font-sans">{dq.missingPrices === 0 ? '✓' : '⚠'} Thiếu giá vào/ra</div>
              <div className="text-slate-200">{dq.missingPrices} bản ghi</div>
            </div>
            <div className={`p-2 rounded-lg border ${dq.pipsHealed === 0 ? 'border-emerald-800/50' : 'border-amber-600'}`}>
              <div className="text-slate-400 font-sans">{dq.pipsHealed === 0 ? '✓' : '⚠'} Pips tự chữa</div>
              <div className="text-slate-200">{dq.pipsHealed} bản ghi · Σ|chênh| {dq.pipsHealedAbs}</div>
            </div>
            <div className={`p-2 rounded-lg border ${dq.outlierCount === 0 ? 'border-emerald-800/50' : 'border-amber-600'}`}>
              <div className="text-slate-400 font-sans">{dq.outlierCount === 0 ? '✓' : '⚠'} Outlier lot (đã loại khỏi $)</div>
              <div className="text-slate-200">{dq.outlierCount} lệnh</div>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 font-sans">
            "Pips tự chữa" = pips đã lưu ≠ pips tính lại từ giá vào/ra (bug cũ hardcode pipSize 0.0001) — REPORT đã tự dùng giá trị đúng trong mọi tổng, dữ liệu gốc không bị sửa.
          </div>
        </div>
      </div>

      {/* ĐỐI ỨNG BENCHMARK — so sánh với strategy tham chiếu (kaizen) */}
      <BenchmarkPanel
        systemStats={fs}
        systemCurve={equityCurve(fj)}
        systemUsd={totalUsd}
        cutoff={cutoff}
        range={range}
      />

      {/* Đường cong tăng trưởng R (toàn thời gian) */}
      <div className="glass-panel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-slate-200">ĐƯỜNG CONG TĂNG TRƯỞNG (R TÍCH LŨY)</div>
          <span className={`text-xs font-mono font-bold ${stats.totalR >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {stats.totalR >= 0 ? '+' : ''}{stats.totalR} R
          </span>
        </div>

        <div className="w-full h-48 bg-[#080c14] rounded-lg border border-[#1e2b48] p-2">
          {curve.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
              Chưa có dữ liệu — đường cong sẽ vẽ sau khi lệnh đầu tiên được ghi sổ.
            </div>
          ) : (
            <svg className="w-full h-full" viewBox="0 0 600 150" preserveAspectRatio="none">
              <line x1="0" y1="75" x2="600" y2="75" stroke="#162238" strokeDasharray="4" />
              <polyline
                points={points}
                fill="none"
                stroke={stats.totalR >= 0 ? '#10b981' : '#ef4444'}
                strokeWidth="2.5"
              />
              {curve.length > 0 && (() => {
                const last = curve[curve.length - 1];
                const x = curve.length === 1 ? 300 : 590;
                const y = 75 - (last.y / maxY) * 60;
                return <circle cx={x} cy={y} r="4" fill={stats.totalR >= 0 ? '#10b981' : '#ef4444'} />;
              })()}
            </svg>
          )}
        </div>
      </div>

      {/* Bảng sổ tín hiệu */}
      <div className="glass-panel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <BookOpen size={16} className="text-amber-400" />
            SỔ TÍN HIỆU — LỊCH SỬ LỆNH ĐÃ ĐÓNG
          </div>
          <span className="text-xs text-slate-400 font-mono">{journal.length} bản ghi · lưu trên máy này</span>
        </div>

        {journal.length === 0 ? (
          <div className="text-xs text-slate-500 bg-[#0b0f19] p-4 rounded-lg border border-[#1e2b48] text-center">
            Sổ đang trống. Vào tab FLIGHT → bấm 1-CLICK mở lệnh → đánh dấu kết quả (✓TP / ✗SL / =BE / ĐÓNG TAY),
            hệ thống sẽ tự ghi nhận R và thống kê tại đây.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#1e2b48] text-slate-400 font-mono">
                  <th className="py-2">Đóng lệnh</th>
                  <th>Mã</th>
                  <th>Chiều</th>
                  <th>Engine</th>
                  <th>Tầng</th>
                  <th>Lot</th>
                  <th>Vào</th>
                  <th>Thoát</th>
                  <th>Kết quả</th>
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
                    <td className="text-slate-400 text-[11px]">{j.engineName}</td>
                    <td className="text-slate-400">{j.tier}</td>
                    <td>{j.lot}</td>
                    <td>{j.entryPrice}</td>
                    <td>{j.exitPrice}</td>
                    <td className={`${OUTCOME_META[j.outcome].color} font-bold`}>{OUTCOME_META[j.outcome].label}</td>
                    <td className={`text-right font-bold ${j.rMultiple >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {j.rMultiple >= 0 ? '+' : ''}{j.rMultiple}R
                    </td>
                    {(() => { const usd = entryPnlUsd(j); return (
                    <td className={`text-right font-bold ${usd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {usd >= 0 ? '+' : '-'}{fmtUsd(Math.abs(usd))}
                    </td>); })()}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PHÂN TÍCH KAIZEN — yếu tố nào đang hiệu quả */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <FlaskConical size={16} className="text-purple-400" />
            PHÂN TÍCH KAIZEN — TỐI ƯU TÍN HIỆU TƯƠNG LAI
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              {kaizen.totalEvaluated} lượt đánh giá · {kaizen.totalClosed} lệnh đã đóng
            </span>
            <button
              onClick={() => { if (window.confirm('Xóa nhật ký Kaizen?')) onClearKaizen(); }}
              disabled={kaizen.totalEvaluated === 0}
              className="text-[10px] px-2 py-1 rounded bg-[#17223b] text-slate-400 border border-[#243356] hover:text-white disabled:opacity-40"
            >
              Xóa NK Kaizen
            </button>
          </div>
        </div>

        {kaizen.totalEvaluated === 0 ? (
          <div className="text-xs text-slate-500 bg-[#0b0f19] p-4 rounded-lg border border-[#1e2b48] text-center">
            Engine đang thu thập dữ liệu thật. Nhật ký Kaizen sẽ ghi lại mọi lượt đánh giá tín hiệu
            (điểm từng yếu tố + bối cảnh thị trường + tin tức) để phân tích tại đây.
          </div>
        ) : (
          <>
            {/* Hiệu quả theo engine / verdict / phiên */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-[#0b0f19] p-3 rounded-lg border border-[#1e2b48]">
                <div className="font-bold text-slate-300 mb-2">THEO ENGINE</div>
                {kaizen.byEngine.map((e) => (
                  <div key={e.engine} className="flex justify-between py-1 font-mono border-b border-[#1e2b48]/50 last:border-0">
                    <span className="text-slate-400">{e.engine}</span>
                    <span><strong className={e.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}>{e.winRate}%</strong> <span className="text-slate-500">({e.closed}/{e.evaluated})</span></span>
                  </div>
                ))}
              </div>
              <div className="bg-[#0b0f19] p-3 rounded-lg border border-[#1e2b48]">
                <div className="font-bold text-slate-300 mb-2">THEO VERDICT</div>
                {kaizen.byVerdict.map((v) => (
                  <div key={v.verdict} className="flex justify-between py-1 font-mono border-b border-[#1e2b48]/50 last:border-0">
                    <span className="text-slate-400">{v.verdict}</span>
                    <span><strong className={v.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}>{v.winRate}%</strong> <span className="text-slate-500">({v.closed}/{v.evaluated})</span></span>
                  </div>
                ))}
              </div>
              <div className="bg-[#0b0f19] p-3 rounded-lg border border-[#1e2b48]">
                <div className="font-bold text-slate-300 mb-2">THEO PHIÊN</div>
                {kaizen.bySession.map((s) => (
                  <div key={s.session} className="flex justify-between py-1 font-mono border-b border-[#1e2b48]/50 last:border-0">
                    <span className="text-slate-400">{s.session}</span>
                    <span><strong className={s.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}>{s.winRate}%</strong> <span className="text-slate-500">({s.closed}/{s.evaluated})</span></span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hiệu quả từng yếu tố chấm điểm */}
            <div>
              <div className="text-xs font-bold text-slate-300 mb-2">HIỆU QUẢ TỪNG YẾU TỐ CHẤM ĐIỂM (khi yếu tố ĐẠT)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[#1e2b48] text-slate-400 font-mono">
                      <th className="py-2">Yếu tố</th>
                      <th className="text-right">Lượt ĐG</th>
                      <th className="text-right">Tỉ lệ đạt</th>
                      <th className="text-right">Lệnh đã đóng</th>
                      <th className="text-right">Win rate khi đạt</th>
                      <th className="text-right">Avg R khi đạt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2b48] font-mono">
                    {kaizen.factors.map((f) => (
                      <tr key={f.factorId} className="hover:bg-[#17223b]/40">
                        <td className="py-2 text-slate-200 font-sans font-medium">{f.label}</td>
                        <td className="text-right text-slate-400">{f.evaluated}</td>
                        <td className="text-right text-slate-400">{f.evaluated ? Math.round((f.passed / f.evaluated) * 100) : 0}%</td>
                        <td className="text-right text-slate-400">{f.closedWithPass}</td>
                        <td className={`text-right font-bold ${f.closedWithPass === 0 ? 'text-slate-500' : f.winRateWhenPassed >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {f.closedWithPass === 0 ? '—' : `${f.winRateWhenPassed}%`}
                        </td>
                        <td className={`text-right font-bold ${f.closedWithPass === 0 ? 'text-slate-500' : f.avgRWhenPassed >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {f.closedWithPass === 0 ? '—' : `${f.avgRWhenPassed >= 0 ? '+' : ''}${f.avgRWhenPassed}R`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-[10px] text-slate-500 mt-2">
                Đọc: yếu tố nào có win rate cao khi đạt → ưu tiên trong tương lai; yếu tố win rate thấp → xem xét hạ điểm hoặc bỏ.
              </div>
            </div>
          </>
        )}
      </div>

      {/* KAIZEN ENGINE — sinh finding từ dữ liệu thật → kho kiến thức */}
      <KaizenEnginePanel journal={fj} kaizen={kaizen} />

      {/* Export + Xóa sổ + Reset toàn bộ */}
      <div className="glass-panel p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-slate-200">XUẤT BÁO CÁO SỔ TÍN HIỆU (HTML)</div>
          <div className="text-xs text-slate-400">
            Tải về file HTML chứa toàn bộ thống kê thật và lịch sử lệnh từ sổ.
            {resetMarkTxt && (
              <span className="text-emerald-400 font-mono"> · Thống kê thật từ {resetMarkTxt} (sau reset)</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadReport}
            disabled={journal.length === 0}
            className="py-2.5 px-5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-sky-950"
          >
            <Download size={15} />
            XUẤT BÁO CÁO HTML
          </button>
          <button
            onClick={onClearJournal}
            disabled={journal.length === 0}
            className="py-2.5 px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 disabled:opacity-40 disabled:cursor-not-allowed text-rose-400 border border-rose-500/40 font-bold text-xs flex items-center gap-2 transition-all"
          >
            <Trash2 size={14} />
            XÓA SỔ
          </button>
          <button
            onClick={onResetAll}
            title="Xóa sổ tín hiệu + nhật ký Kaizen + bản ghi Neural + lệnh đang mở. Từ sau reset chỉ tính bản ghi thật mới."
            className="py-2.5 px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center gap-2 transition-all"
          >
            <RotateCcw size={14} />
            RESET TOÀN BỘ
          </button>
        </div>
      </div>
    </div>
  );
};
