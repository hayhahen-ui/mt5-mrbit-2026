import React, { useState } from 'react';
import { referenceSourcesPrompt } from '../../data/referenceSources';
import { Signal, Asset, Position, JournalEntry, JournalOutcome, MarketSnapshot } from '../../types';
import { TrendingUp, TrendingDown, Target, Shield, Zap, CheckCircle2, ChevronRight, X, AlertTriangle, BarChart3, RotateCcw, PencilLine } from 'lucide-react';
import { totalScore, maxScore, getVerdict, VERDICT_META, NewsFilterResult } from '../../lib/scoring';
import { usdPerPipPerLot, pipSizeOf, fmtUsd } from '../../lib/account';
import { NeuralPanel } from '../NeuralPanel';
import { AiAsk } from '../AiAsk';
import { getOutlook, findSentiment, sentimentBias } from '../../lib/sentiment';
import { heatmapSummary } from '../../lib/priceHistory';

interface FlightTabProps {
  signal: Signal | undefined;
  asset: Asset;
  positions: Position[];
  onExecuteTrade: (sig: Signal, lot: number) => void;
  onClosePosition: (id: string) => void;
  onMoveToBE: (id: string) => void;
  /** Đánh dấu kết quả khi đóng lệnh → ghi sổ tín hiệu */
  onCloseWithOutcome: (id: string, outcome: JournalOutcome) => void;
  newsFilter: NewsFilterResult;
  recentJournal: JournalEntry[];
  snapshot: MarketSnapshot | undefined;
  dataTick: number;
}

export const FlightTab: React.FC<FlightTabProps> = ({
  signal,
  asset,
  positions,
  onExecuteTrade,
  onClosePosition,
  onMoveToBE,
  onCloseWithOutcome,
  newsFilter,
  recentJournal,
  snapshot,
  dataTick
}) => {
  if (!signal) {
    return (
      <div className="glass-panel p-8 text-center text-slate-400 space-y-3">
        <div className="text-3xl">🔍</div>
        <div className="text-lg font-bold text-slate-200">Đang quét tìm cơ hội cho #{asset.symbol}</div>
        <div className="text-sm max-w-md mx-auto text-slate-400">
          {(asset.warmup || '0/20') !== '20/20'
            ? `Engine đang thu thập dữ liệu thật (${asset.warmup || '0/20'} mẫu từ ${asset.sourceName || 'nguồn giá'}). Tín hiệu sẽ xuất hiện khi đủ mẫu.`
            : 'Chưa có cấu trúc giá đạt chuẩn. Hệ thống tiếp tục theo dõi trên dữ liệu thật.'}
        </div>
        <div className="text-[11px] font-mono text-slate-500">
          Nguồn: {asset.sourceName || '—'} · Cập nhật: {asset.updatedAt ? new Date(asset.updatedAt).toLocaleTimeString('vi-VN') : '—'}
        </div>
      </div>
    );
  }

  const isBuy = signal.direction === 'BUY';
  const score = totalScore(signal.scoreBreakdown);
  const scoreMax = maxScore(signal.scoreBreakdown);
  const verdict = signal.verdict || getVerdict(score);
  const verdictMeta = VERDICT_META[verdict];

  /* ── KẾ HOẠCH LỆNH CHỈNH TAY ─────────────────────────────
     Mặc định lấy từ engine; user sửa trực tiếp trên ô giá trị.
     Reset khi đổi mã, hoặc bấm nút ↺. 1-Click dùng đúng số đang hiện. */
  const planDefaults = () => ({
    lot: String(signal.suggestedLot),
    sl: String(signal.stopLoss),
    tp1: String(signal.tp1),
    tp2: String(signal.tp2),
    tp3: String(signal.tp3),
  });
  const [planSym, setPlanSym] = useState(signal.symbol);
  const [plan, setPlan] = useState(planDefaults);
  if (planSym !== signal.symbol) {
    setPlanSym(signal.symbol);
    setPlan(planDefaults());
  }
  const setPlanField = (k: keyof typeof plan, v: string) =>
    setPlan((p) => ({ ...p, [k]: v }));

  const pipSize = pipSizeOf(asset.symbol);
  const usdPip = usdPerPipPerLot(asset.symbol);
  const entry = signal.entryPrice;
  const planLot = Math.max(0.01, parseFloat(plan.lot) || 0);
  const planSL = parseFloat(plan.sl);
  const planTP = [parseFloat(plan.tp1), parseFloat(plan.tp2), parseFloat(plan.tp3)];
  // Chia lot đúng công thức App.handleExecuteTrade: 50% / 30% / phần còn lại
  const lot1 = Number((planLot * 0.5).toFixed(2));
  const lot2 = Number((planLot * 0.3).toFixed(2));
  const lot3 = Number((planLot - lot1 - lot2).toFixed(2));
  const tierLots = [lot1, lot2, lot3];
  const usdFor = (px: number, lotT: number) =>
    !isFinite(px) || !isFinite(lotT) ? 0
      : Number(((Math.abs(px - entry) / pipSize) * lotT * usdPip).toFixed(2));

  // Kiểm tra hợp lệ theo chiều lệnh
  const validNum = (n: number) => isFinite(n) && n > 0;
  const planError = !validNum(planLot)
    ? 'Lot phải > 0'
    : !validNum(planSL) || planTP.some((t) => !validNum(t))
      ? 'Giá SL/TP chưa hợp lệ'
      : isBuy
        ? (planSL >= entry ? 'SL phải nằm DƯỚI giá vào (lệnh BUY)' : null) ||
          (planTP[0] <= entry ? 'TP1 phải nằm TRÊN giá vào (lệnh BUY)' : null) ||
          (planTP[1] < planTP[0] ? 'TP2 phải ≥ TP1' : null) ||
          (planTP[2] < planTP[1] ? 'TP3 phải ≥ TP2' : null)
        : (planSL <= entry ? 'SL phải nằm TRÊN giá vào (lệnh SELL)' : null) ||
          (planTP[0] >= entry ? 'TP1 phải nằm DƯỚI giá vào (lệnh SELL)' : null) ||
          (planTP[1] > planTP[0] ? 'TP2 phải ≤ TP1' : null) ||
          (planTP[2] > planTP[1] ? 'TP3 phải ≤ TP2' : null);

  const totalRiskUsd = usdFor(planSL, planLot);
  const totalWinUsd = planTP.reduce((a, tp, i) => a + usdFor(tp, tierLots[i]), 0);

  const fireOneClick = () => {
    if (planError) return;
    onExecuteTrade(
      { ...signal, stopLoss: planSL, tp1: planTP[0], tp2: planTP[1], tp3: planTP[2] },
      planLot
    );
  };

  return (
    <div className="space-y-4">
      {/* 0. CẢNH BÁO BỘ LỌC TIN TỨC */}
      {newsFilter.blocked && (
        <div className="glass-panel p-4 border-l-4 border-l-rose-500 flex items-start gap-3">
          <AlertTriangle size={18} className="text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <div className="font-bold text-rose-400">CẢNH BÁO TIN TỨC — CÂN NHẮC ĐỨNG NGOÀI</div>
            <div className="text-slate-300">{newsFilter.reason}</div>
            <div className="text-slate-400">Biến động mạnh khi tin ra có thể quét SL. Nên chờ qua cửa sổ tin mới vào lệnh.</div>
          </div>
        </div>
      )}
      {/* 1. CANDLESTICK CHART WITH SMC OVERLAYS */}
      <div className="glass-panel p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-200">{asset.name}</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#17223b] text-sky-400 border border-[#243356]">
              {signal.timeframe} · SMC PRO HUD
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-sm">
            <span className="text-slate-400">Bid: <strong className="text-slate-200">{asset.price.toFixed(asset.digits)}</strong></span>
            <span className="text-slate-400">Spread: <strong className="text-sky-400">{asset.spread} pips</strong></span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#17223b] text-slate-400 border border-[#243356]" title={`Nguồn giá: ${asset.sourceName || '—'}`}>
              {(asset.dataSource || 'OFFLINE') === 'LIVE' ? '🟢' : (asset.dataSource || 'OFFLINE') === 'DAILY' ? '🔵' : (asset.dataSource || 'OFFLINE') === 'SIM' ? '🟡' : '⚪'} {asset.sourceName || 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* SVG Interactive Candlestick Chart */}
        <div className="relative w-full h-64 bg-[#080c14] rounded-lg border border-[#1e2b48] overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 800 240" preserveAspectRatio="none">
            {/* Grid Lines */}
            <line x1="0" y1="60" x2="800" y2="60" stroke="#162238" strokeDasharray="4" />
            <line x1="0" y1="120" x2="800" y2="120" stroke="#162238" strokeDasharray="4" />
            <line x1="0" y1="180" x2="800" y2="180" stroke="#162238" strokeDasharray="4" />

            {/* SMC Fair Value Gap (FVG) Shaded Box */}
            <rect x="240" y="110" width="220" height="35" fill="rgba(56, 189, 248, 0.12)" stroke="rgba(56, 189, 248, 0.4)" strokeDasharray="2" />
            <text x="248" y="132" fill="#38bdf8" fontSize="10" fontFamily="JetBrains Mono">BULLISH FVG (AOI)</text>

            {/* SMC Order Block (OB) Box */}
            <rect x="120" y="150" width="160" height="40" fill="rgba(16, 185, 129, 0.15)" stroke="rgba(16, 185, 129, 0.5)" />
            <text x="128" y="174" fill="#10b981" fontSize="10" fontFamily="JetBrains Mono">DEMAND ORDER BLOCK</text>

            {/* Break of Structure (BOS) Line */}
            <line x1="380" y1="80" x2="780" y2="80" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4" />
            <text x="400" y="74" fill="#f59e0b" fontSize="10" fontFamily="JetBrains Mono">CHoCH / BOS CONFIRMED ▲</text>

            {/* Simulated Candlesticks */}
            {[
              { x: 40, o: 170, c: 155, h: 145, l: 180, green: false },
              { x: 90, o: 155, c: 165, h: 150, l: 170, green: false },
              { x: 140, o: 165, c: 185, h: 160, l: 195, green: false }, // OB candle
              { x: 190, o: 185, c: 140, h: 135, l: 190, green: true },  // Impulsive move
              { x: 240, o: 140, c: 110, h: 105, l: 145, green: true },  // Gap
              { x: 290, o: 110, c: 80,  h: 75,  l: 115, green: true },  // High
              { x: 340, o: 80,  c: 95,  h: 75,  l: 100, green: false }, // Pullback
              { x: 390, o: 95,  c: 120, h: 90,  l: 125, green: false }, // Retesting FVG
              { x: 440, o: 120, c: 130, h: 115, l: 145, green: false }, // Pinbar wick
              { x: 490, o: 130, c: 110, h: 105, l: 135, green: true },  // Entry confirmation
              { x: 540, o: 110, c: 90,  h: 85,  l: 115, green: true },
              { x: 590, o: 90,  c: 75,  h: 70,  l: 95,  green: true },
              { x: 640, o: 75,  c: 65,  h: 60,  l: 80,  green: true },
              { x: 690, o: 65,  c: 55,  h: 50,  l: 70,  green: true },
              { x: 740, o: 55,  c: 45,  h: 40,  l: 60,  green: true }
            ].map((c, i) => (
              <g key={i}>
                {/* Wick */}
                <line x1={c.x} y1={c.h} x2={c.x} y2={c.l} stroke={c.green ? '#10b981' : '#ef4444'} strokeWidth="1.5" />
                {/* Body */}
                <rect
                  x={c.x - 7}
                  y={Math.min(c.o, c.c)}
                  width="14"
                  height={Math.max(4, Math.abs(c.o - c.c))}
                  fill={c.green ? '#10b981' : '#ef4444'}
                  rx="1"
                />
              </g>
            ))}

            {/* Stop Loss & Take Profit Target Lines */}
            <line x1="450" y1="145" x2="800" y2="145" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3" />
            <text x="710" y="141" fill="#ef4444" fontSize="10" fontFamily="JetBrains Mono">SL: {signal.stopLoss}</text>

            <line x1="450" y1="105" x2="800" y2="105" stroke="#38bdf8" strokeWidth="1" />
            <text x="710" y="101" fill="#38bdf8" fontSize="10" fontFamily="JetBrains Mono">ENTRY: {signal.entryPrice}</text>

            <line x1="450" y1="65" x2="800" y2="65" stroke="#10b981" strokeWidth="1" strokeDasharray="3" />
            <text x="710" y="61" fill="#10b981" fontSize="10" fontFamily="JetBrains Mono">TP1: {signal.tp1}</text>
          </svg>
        </div>
      </div>

      {/* 2. THE FLIGHT CARD (TÍN HIỆU & THỰC THI) */}
      <div className="glass-panel p-5 space-y-4 border-l-4 border-l-emerald-500">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-lg font-bold font-mono text-sm flex items-center gap-1.5 ${
              isBuy ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
            }`}>
              {isBuy ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {signal.direction} SIGNAL
            </span>
            <span className="font-mono text-lg font-bold text-slate-100">#{signal.symbol}</span>
            <span className="text-xs text-slate-400 font-mono">({signal.timeframe})</span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Chất lượng:</span>
              <span className="font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                ⭐⭐⭐⭐⭐ {signal.quality}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Xác suất thắng:</span>
              <span className="font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                P(win): {signal.pWin}%
              </span>
            </div>
          </div>
        </div>

        {/* Engine and Rationale */}
        <div className="bg-[#0b0f19] p-3 rounded-lg border border-[#1e2b48] text-xs space-y-1">
          <div className="text-slate-400 flex items-center gap-1.5">
            <Zap size={13} className="text-sky-400" />
            <span>Thuật toán kích hoạt:</span>
            <strong className="text-slate-200 font-mono">{signal.engineName}</strong>
          </div>
          <div className="text-slate-300 italic">
            "{signal.rationale}"
          </div>
        </div>

        {/* 2b. CHI TIẾT CHẤM ĐIỂM MINH BẠCH (Trade.2026-style) */}
        <div className="bg-[#0b0f19] p-4 rounded-lg border border-[#1e2b48] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <BarChart3 size={14} className="text-amber-400" />
              CHI TIẾT CHẤM ĐIỂM TÍN HIỆU
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-slate-100">
                {score}<span className="text-slate-400">/{scoreMax}</span>
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${verdictMeta.bg} ${verdictMeta.color} ${verdictMeta.border}`}>
                {verdictMeta.label}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {(signal.scoreBreakdown || []).map((f) => (
              <div key={f.id} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <span className={f.passed ? 'text-emerald-400' : 'text-slate-500'}>
                      {f.passed ? '✓' : '○'}
                    </span>
                    {f.label}
                  </span>
                  <span className="font-mono text-slate-400">
                    <strong className={f.passed ? 'text-slate-200' : 'text-slate-500'}>{f.points}</strong>/{f.maxPoints}
                  </span>
                </div>
                <div className="w-full bg-[#17223b] h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${f.passed ? 'bg-sky-400' : 'bg-slate-600'}`}
                    style={{ width: `${(f.points / f.maxPoints) * 100}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500 pl-4">{f.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 2c. NEURAL SHADOW (skill Mr.Bit P0) */}
        <NeuralPanel signal={signal} snapshot={snapshot} refreshKey={dataTick} />

        {/* KẾ HOẠCH LỆNH — CHỈNH TAY TRƯỚC KHI BẤM 1-CLICK */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <PencilLine size={12} className="text-sky-400" />
              KẾ HOẠCH LỆNH — SỬA TRỰC TIẾP TRÊN Ô GIÁ TRỊ
            </div>
            <button
              onClick={() => setPlan(planDefaults())}
              className="text-[10px] font-bold text-slate-400 hover:text-sky-300 flex items-center gap-1 border border-[#243356] rounded-lg px-2 py-1"
              title="Trả về giá trị engine đề xuất"
            >
              <RotateCcw size={10} /> Về giá trị engine
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 text-xs font-mono">
            <div className="bg-[#0b0f19] p-2.5 rounded-lg border border-[#1e2b48]">
              <div className="text-[10px] text-slate-400">ENTRY PRICE</div>
              <div className="text-sm font-bold text-slate-100">{entry.toFixed(asset.digits)}</div>
              <div className="text-[10px] text-slate-500 mt-1">giá thị trường lúc bấm</div>
            </div>
            {([
              { k: 'sl', label: 'STOP LOSS', cls: 'border-rose-900/50', tcls: 'text-rose-400', note: `Rủi ro: -${fmtUsd(totalRiskUsd)}` },
              { k: 'tp1', label: `TP1 · ${tierLots[0]} lot`, cls: 'border-emerald-900/50', tcls: 'text-emerald-400', note: `Lãi: +${fmtUsd(usdFor(planTP[0], tierLots[0]))}` },
              { k: 'tp2', label: `TP2 · ${tierLots[1]} lot`, cls: 'border-emerald-900/50', tcls: 'text-emerald-400', note: `Lãi: +${fmtUsd(usdFor(planTP[1], tierLots[1]))}` },
              { k: 'tp3', label: `TP3 · ${tierLots[2]} lot`, cls: 'border-emerald-900/50', tcls: 'text-emerald-400', note: `Lãi: +${fmtUsd(usdFor(planTP[2], tierLots[2]))}` },
            ] as const).map((f) => (
              <div key={f.k} className={`bg-[#0b0f19] p-2.5 rounded-lg border ${f.cls}`}>
                <div className={`text-[10px] ${f.tcls} font-bold`}>{f.label}</div>
                <input
                  value={plan[f.k]}
                  onChange={(e) => setPlanField(f.k, e.target.value)}
                  inputMode="decimal"
                  className={`w-full bg-transparent text-sm font-bold ${f.tcls} focus:outline-none border-b border-transparent focus:border-sky-500`}
                />
                <div className="text-[10px] text-slate-400 mt-1">{f.note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 1-CLICK ORDER EXECUTION BAR */}
        <div className="bg-[#17223b] p-3 rounded-xl border border-[#243356] flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs space-y-1.5">
            <div className="text-slate-300 font-semibold flex items-center gap-2">
              <span>Khối lượng:</span>
              <input
                value={plan.lot}
                onChange={(e) => setPlanField('lot', e.target.value)}
                inputMode="decimal"
                className="w-20 bg-[#0b0f19] border border-[#243356] rounded-lg px-2 py-1 font-mono font-bold text-sky-400 text-sm focus:outline-none focus:border-sky-500"
              />
              <span className="font-mono">Lot</span>
              <span className="text-[10px] text-slate-500 font-normal">(engine đề xuất {signal.suggestedLot})</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Tự động chia 3 lệnh: TP1 (50%) · TP2 (30%) · TP3 (20%) · BE bấm tay từng lệnh (nút DỜI BE)
            </div>
            <div className="text-[11px] font-mono">
              <span className="text-rose-400 font-bold">Rủi ro tối đa: -{fmtUsd(totalRiskUsd)}</span>
              <span className="text-slate-500"> (dính SL cả 3)</span>
              <span className="text-slate-600"> · </span>
              <span className="text-emerald-400 font-bold">Lãi tối đa: +{fmtUsd(totalWinUsd)}</span>
              <span className="text-slate-500"> (chạm cả 3 TP)</span>
            </div>
            {planError && (
              <div className="text-[11px] text-amber-400 font-bold">⚠ {planError}</div>
            )}
          </div>

      </div>

      {/* AI PHÂN TÍCH TÍN HIỆU */}
      <AiAsk
        buttonLabel="✨ AI PHÂN TÍCH TÍN HIỆU NÀY"
        buildPrompt={async () => {
          const factors = (signal.scoreBreakdown || [])
            .map((f) => `- ${f.label}: ${f.passed ? 'ĐẠT' : 'không đạt'} (${f.points}/${f.maxPoints}) — ${f.detail || ''}`)
            .join('\n');
          const news = snapshot?.newsNear?.length ? snapshot.newsNear.join('; ') : 'không có';
          return [
            `Phân tích tín hiệu giao dịch #${signal.symbol} (${signal.timeframe || 'M15'}):`,
            `- Hướng: ${signal.direction}, chất lượng ${signal.quality}, điểm ${score}/${scoreMax}, engine ${signal.engineName || signal.engine}`,
            `- Entry: ${entry}, SL: ${planSL}, TP1: ${planTP[0]}, TP2: ${planTP[1]}, TP3: ${planTP[2]}, lot kế hoạch: ${planLot}`,
            `- Rủi ro tối đa: $${totalRiskUsd}, lãi tối đa: $${totalWinUsd}`,
            `- Chi tiết chấm điểm:\n${factors}`,
            `- Phiên đang mở: ${snapshot?.session || '—'}, biến động: ${snapshot?.atrProxy ?? '—'}%`,
            `- Tin HIGH gần (±60 phút): ${news}`,
            `- Nguồn giá: ${asset.sourceName || '—'}`,
            `- Heatmap đa khung (tự tính từ giá thật):\n${heatmapSummary()}`,
            `- Tâm lý đám đông MyFxBook: ${await (async () => {
              try {
                const r = await getOutlook(false);
                const row = findSentiment(r.symbols, signal.symbol);
                return row
                  ? `#${signal.symbol} LONG ${row.longPct}% / SHORT ${row.shortPct}% — ${sentimentBias(row)}`
                  : 'chưa có dữ liệu (nhập tài khoản MyFxBook ở HELP)';
              } catch { return 'không lấy được'; }
            })()}`,
            '',
            'Hãy phân tích: 1) Luận điểm vào lệnh có vững không, 2) Rủi ro lớn nhất,',
            '3) Khi nào nên bỏ/hủy kế hoạch, 4) Gợi ý quản lý lệnh (dời BE/chốt từng phần).',
            'Ngắn gọn, tiếng Việt.',
            '',
            referenceSourcesPrompt(),
          ].join('\n');
        }}
      />

      <div>
          <button
            onClick={fireOneClick}
            disabled={!!planError}
            className={`py-3 px-6 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg flex items-center gap-2 ${
              planError
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : isBuy
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-950/50 hover:scale-[1.02]'
                  : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-950/50 hover:scale-[1.02]'
            }`}
          >
            <Zap size={18} />
            1-CLICK {signal.direction} NOW
          </button>
        </div>
      </div>

      {/* 3. ACTIVE SIMULATED POSITIONS */}
      {positions.length > 0 && (
        <div className="glass-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-slate-200">VỊ THẾ ĐANG MỞ (LIVE POSITIONS)</span>
            <span className="text-xs font-mono text-emerald-400 font-bold">
              Tổng PnL: ${positions.reduce((acc, p) => acc + p.pnl, 0).toFixed(2)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#1e2b48] text-slate-400 font-mono">
                  <th className="py-2">Mã lệnh</th>
                  <th>Cặp</th>
                  <th>Chiều</th>
                  <th>Lot</th>
                  <th>Giá vào</th>
                  <th>Hiện tại</th>
                  <th>SL / TP</th>
                  <th>Lãi/Lỗ</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2b48] font-mono">
                {positions.map((pos) => (
                  <tr key={pos.id} className="hover:bg-[#17223b]/40">
                    <td className="py-2 text-slate-400">{pos.id}</td>
                    <td className="font-bold text-slate-200">{pos.symbol}</td>
                    <td className={pos.type === 'BUY' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {pos.type} ({pos.tier})
                    </td>
                    <td>{pos.lot}</td>
                    <td>{pos.entryPrice.toFixed(asset.digits)}</td>
                    <td>{pos.currentPrice.toFixed(asset.digits)}</td>
                    <td className="text-[11px] text-slate-400">
                      SL: {pos.sl.toFixed(asset.digits)} | TP: {pos.tp.toFixed(asset.digits)}
                    </td>
                    <td className={pos.pnl >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)} ({pos.pips.toFixed(1)}p)
                    </td>
                    <td className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <button
                          onClick={() => onMoveToBE(pos.id)}
                          className="px-2 py-1 rounded bg-sky-950 text-sky-400 border border-sky-800 text-[10px] hover:bg-sky-900"
                          title="Dời Stop Loss về hòa vốn"
                        >
                          DỜI BE
                        </button>
                        <button
                          onClick={() => onCloseWithOutcome(pos.id, 'TP')}
                          className="px-2 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] hover:bg-emerald-900 font-bold"
                          title="Đánh dấu chạm TP — ghi sổ tín hiệu"
                        >
                          ✓ TP
                        </button>
                        <button
                          onClick={() => onCloseWithOutcome(pos.id, 'SL')}
                          className="px-2 py-1 rounded bg-rose-950 text-rose-400 border border-rose-800 text-[10px] hover:bg-rose-900 font-bold"
                          title="Đánh dấu dính SL — ghi sổ tín hiệu"
                        >
                          ✗ SL
                        </button>
                        <button
                          onClick={() => onCloseWithOutcome(pos.id, 'BE')}
                          className="px-2 py-1 rounded bg-sky-950 text-sky-300 border border-sky-800 text-[10px] hover:bg-sky-900"
                          title="Đóng hòa vốn — ghi sổ tín hiệu"
                        >
                          = BE
                        </button>
                        <button
                          onClick={() => onCloseWithOutcome(pos.id, 'MANUAL')}
                          className="px-2 py-1 rounded bg-[#17223b] text-slate-400 border border-[#243356] text-[10px] hover:text-white"
                          title="Đóng tay theo giá hiện tại — ghi sổ tín hiệu"
                        >
                          ĐÓNG TAY
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. DẢI TÍN HIỆU GẦN ĐÂY — từ sổ tín hiệu thật */}
      <div className="glass-panel p-4 space-y-2.5">
        <div className="text-xs text-slate-400">DẢI TÍN HIỆU GẦN ĐÂY (SỔ TÍN HIỆU)</div>
        {recentJournal.length === 0 ? (
          <div className="text-xs text-slate-500 bg-[#0b0f19] p-3 rounded-lg border border-[#1e2b48]">
            Chưa có lệnh nào được ghi sổ. Thực thi tín hiệu từ nút 1-CLICK rồi đánh dấu kết quả (✓TP / ✗SL / =BE) để sổ tự ghi nhận.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 font-mono text-xs">
            {recentJournal.slice(0, 3).map((j) => (
              <div
                key={j.id}
                className={`bg-[#0b0f19] p-2.5 rounded-lg border flex items-center justify-between ${
                  j.outcome === 'TP' ? 'border-emerald-900/60' : j.outcome === 'SL' ? 'border-rose-900/60' : 'border-sky-900/60'
                }`}
              >
                <div>
                  <div className="font-bold text-slate-200">
                    #{j.symbol} {j.direction} @ {j.entryPrice}
                  </div>
                  <div className="text-[10px] text-slate-400">{j.engineName} · {j.tier}</div>
                </div>
                <span
                  className={`px-2 py-1 rounded font-bold text-[11px] ${
                    j.outcome === 'TP'
                      ? 'bg-emerald-950 text-emerald-400'
                      : j.outcome === 'SL'
                        ? 'bg-rose-950 text-rose-400'
                        : 'bg-sky-950 text-sky-400'
                  }`}
                >
                  {j.outcome === 'TP' ? 'TP' : j.outcome === 'SL' ? 'SL' : j.outcome === 'BE' ? 'BE' : 'TAY'} ({j.rMultiple >= 0 ? '+' : ''}{j.rMultiple}R)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
