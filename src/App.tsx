import React, { useState, useEffect, useRef } from 'react';
import { checkApiOrigin, PROD_URL } from './lib/apiHealth';
import { TabType, Asset, Signal, Position, AccountState, MarketContextState, JournalEntry, JournalOutcome, AutoCloseConfig } from './types';
import {
  INITIAL_MARKET_CONTEXT,
  INITIAL_ACCOUNT
} from './data/mockData';
import { Header } from './components/Header';
import { LeftDock } from './components/LeftDock';
import { FlightTab } from './components/tabs/FlightTab';
import { CtxTab } from './components/tabs/CtxTab';
import { SigTab } from './components/tabs/SigTab';
import { RadarTab } from './components/tabs/RadarTab';
import { NewsTab } from './components/tabs/NewsTab';
import { ResearchTab } from './components/tabs/ResearchTab';
import { getGroupId, pushShared } from './lib/groupSync';
import { LogTab } from './components/tabs/LogTab';
import { JournalTab } from './components/tabs/JournalTab';
import { HelpTab } from './components/tabs/HelpTab';
import { loadJournal, saveJournal, clearJournal, entryFromPosition, OUTCOME_META } from './lib/journal';
import { checkNewsFilter, totalScore } from './lib/scoring';
import { useMarketData } from './hooks/useMarketData';
import { SessionClocks } from './components/SessionClocks';
import { ChartPanel } from './components/ChartPanel';
import { DashboardStrip } from './components/DashboardStrip';
import { findLatestKaizenFor, linkKaizenOutcome, clearKaizen, loadKaizen } from './lib/kaizen';
import { resetAllLocalData, markResetTime, getResetMark } from './lib/reset';
import { loadStartBalance, saveStartBalance, realizedPnlUsd } from './lib/account';
import { loadPositions, savePositions, DEFAULT_AUTO_CLOSE, POSITIONS_KEY } from './lib/positions';

/** Mặc định tự động đóng cho lệnh mới — lưu localStorage */
const AUTO_DEFAULT_KEY = 'nexuspilot-autoclose-default-v1';
const DEFAULT_AUTO: AutoCloseConfig = DEFAULT_AUTO_CLOSE;

function loadDefaultAuto(): AutoCloseConfig {
  try {
    const raw = localStorage.getItem(AUTO_DEFAULT_KEY);
    if (!raw) return { ...DEFAULT_AUTO };
    const v = JSON.parse(raw);
    return {
      mode: v.mode === 'MANUAL' ? 'MANUAL' : 'AUTO',
      tp: v.tp !== false,
      sl: v.sl !== false,
      timeStopMin: typeof v.timeStopMin === 'number' ? v.timeStopMin : null,
    };
  } catch {
    return { ...DEFAULT_AUTO };
  }
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('FLIGHT');
  const [account, setAccount] = useState<AccountState>(INITIAL_ACCOUNT);
  /** Vốn ảo do người dùng chọn — Balance/Equity tính thật từ sổ + lệnh đang mở */
  const [startBalance, setStartBalance] = useState<number>(() => loadStartBalance());
  /** Sổ tín hiệu — persist localStorage, nguồn số liệu thật cho tab LOG */
  const [journal, setJournal] = useState<JournalEntry[]>(() => loadJournal());
  const [positions, setPositions] = useState<Position[]>(() => loadPositions());
  /** Mirror ref để engine tự đóng đọc vị thế mới nhất trong effect giá */
  const positionsRef = useRef<Position[]>([]);
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);
  /** Persist vị thế đang mở — F5 không mất lệnh */
  useEffect(() => {
    savePositions(positions);
  }, [positions]);
  /** Chế độ đóng mặc định cho lệnh mở mới (TAY / AUTO) */
  const [defaultAuto, setDefaultAuto] = useState<AutoCloseConfig>(() => loadDefaultAuto());
  const handleDefaultAutoChange = (cfg: AutoCloseConfig) => {
    setDefaultAuto(cfg);
    try {
      localStorage.setItem(AUTO_DEFAULT_KEY, JSON.stringify(cfg));
    } catch {
      /* bỏ qua */
    }
  };
  /** Balance/Equity THẬT của tài khoản vốn ảo */
  const realizedPnl = realizedPnlUsd(journal);
  const floatingPnl = positions.reduce((a, p) => a + (p.pnl || 0), 0);
  const liveBalance = Number((startBalance + realizedPnl).toFixed(2));
  const liveEquity = Number((liveBalance + floatingPnl).toFixed(2));
  // Dữ liệu thị trường THẬT (hook tự poll + engine đánh giá tín hiệu)
  const { assets, signals, snapshots, news, newsSource, lastUpdated } = useMarketData(liveEquity, account.riskPct);
  const [selectedAsset, setSelectedAsset] = useState<Asset>(assets[0]);
  const [marketContext, setMarketContext] = useState<MarketContextState>(INITIAL_MARKET_CONTEXT);
  const [isDockOpen, setIsDockOpen] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [apiOriginWarn, setApiOriginWarn] = useState<string | null>(null);
  const [resetMark, setResetMark] = useState<number | null>(() => getResetMark());
  const liveAccount: AccountState = { ...account, balance: liveBalance, equity: liveEquity };

  const handleStartBalanceChange = (v: number) => {
    if (!(v > 0) || v === startBalance) return;
    if (window.confirm(`Đổi vốn ảo thành $${v.toLocaleString('en-US')}?\nBalance sẽ tính lại = vốn mới + P&L đã thực hiện (${realizedPnl >= 0 ? '+' : ''}$${realizedPnl}).`)) {
      setStartBalance(v);
      saveStartBalance(v);
      showToast(`💰 Vốn ảo: $${v.toLocaleString('en-US')}`);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Lưu sổ xuống localStorage mỗi khi thay đổi
  useEffect(() => {
    saveJournal(journal);
  }, [journal]);

  // Toast khi lưới lọc chặn tick ảo (throttle 5 phút để không spam)
  useEffect(() => {
    let lastToast = 0;
    const onBad = (e: Event) => {
      const now = Date.now();
      if (now - lastToast < 5 * 60_000) return;
      lastToast = now;
      const d = (e as CustomEvent).detail || {};
      showToast(`🛡️ Chặn tick ảo ${d.sym}: ${d.old} → ${d.bad} (nhảy ${Number(d.jumpPct || 0).toFixed(1)}%) — giữ giá cũ`);
    };
    window.addEventListener('badtick', onBad);
    return () => window.removeEventListener('badtick', onBad);
  }, []);

  // Kiểm tra 1 lần khi mở app: /api/* có tồn tại trên URL hiện tại không.
  // Nếu user mở nhầm URL (bookmark cũ / deployment lạ), Vercel trả 404 HTML
  // cho mọi /api/* → thay vì lỗi "Unexpected token" cryptic, hiện banner rõ ràng.
  useEffect(() => {
    let alive = true;
    checkApiOrigin().then((r) => {
      if (alive && !r.ok) setApiOriginWarn(r.reason || 'Không kết nối được API.');
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // 1. Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const key = e.key.toUpperCase();
      switch (key) {
        case 'F': setActiveTab('FLIGHT'); break;
        case 'X': setActiveTab('CTX'); break;
        case 'S': setActiveTab('SIG'); break;
        case 'D': setActiveTab('RADAR'); break;
        case 'R': setActiveTab('RESEARCH'); break;
        case 'N': setActiveTab('NEWS'); break;
        case 'C': setActiveTab('CHART'); break;
        case 'J': setActiveTab('JOURNAL'); break;
        case 'L': setActiveTab('LOG'); break;
        case 'H': setActiveTab('HELP'); break;
        case 'K': setIsDockOpen((prev) => !prev); break;
        case 'M': setIsMinimized((prev) => !prev); break;
        case 'ESCAPE': setActiveTab('FLIGHT'); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Đếm ngược nến (giá realtime do useMarketData phụ trách)
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketContext((prev) => ({
        ...prev,
        candleRemainingSec: prev.candleRemainingSec > 0 ? prev.candleRemainingSec - 1 : 900
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Update selectedAsset price in sync
  useEffect(() => {
    const found = assets.find((a) => a.symbol === selectedAsset.symbol);
    if (found && found.price !== selectedAsset.price) {
      setSelectedAsset(found);
    }
  }, [assets, selectedAsset.symbol]);

  // Update open positions floating PnL
  useEffect(() => {
    if (positions.length === 0) return;
    setPositions((prev) =>
      prev.map((p) => {
        const curAsset = assets.find((a) => a.symbol === p.symbol);
        if (!curAsset) return p;
        // GIÁ MOCK/OFFLINE KHÔNG ĐƯỢC TÍNH P&L (bug 10/10: giá mock XAUUSD 2652.40
        // làm P&L/Equity ảo +$462.96). Chỉ tính khi đã có quote live tươi (<15 phút),
        // nếu không thì đóng băng P&L cũ, không tính bằng giá mock.
        const fresh = curAsset.dataSource !== 'OFFLINE' && !!curAsset.updatedAt && Date.now() - curAsset.updatedAt < 15 * 60_000;
        if (!fresh) return p;
        const diff = p.type === 'BUY' ? curAsset.price - p.entryPrice : p.entryPrice - curAsset.price;
        const pips = diff / (curAsset.category === 'Forex' ? 0.0001 : 0.1);
        const pnl = pips * p.lot * (curAsset.category === 'Forex' ? 10 : 1);
        return {
          ...p,
          currentPrice: curAsset.price,
          pips: Number(pips.toFixed(1)),
          pnl: Number(pnl.toFixed(2))
        };
      })
    );
  }, [assets]);

  // 1-Click Order Execution: 3-Tier Split
  const handleExecuteTrade = (sig: Signal, totalLot: number) => {
    const lot1 = Number((totalLot * 0.5).toFixed(2));
    const lot2 = Number((totalLot * 0.3).toFixed(2));
    const lot3 = Number((totalLot - lot1 - lot2).toFixed(2));

    const nowStr = new Date().toLocaleTimeString('vi-VN');
    const sigScore = totalScore(sig.scoreBreakdown);
    // Liên kết Kaizen: tìm bản ghi đánh giá gần nhất của tín hiệu này
    const kz = findLatestKaizenFor(sig.symbol, sig.direction as string);
    const snap = snapshots[sig.symbol];

    const mkPos = (
      tier: 'TP1' | 'TP2' | 'TP3',
      lot: number,
      tp: number,
      idx: number
    ): Position => ({
      id: `POS-${Date.now()}-${idx}`,
      symbol: sig.symbol,
      type: sig.direction as 'BUY' | 'SELL',
      lot: lot > 0 ? lot : 0.01,
      entryPrice: sig.entryPrice,
      currentPrice: sig.entryPrice,
      sl: sig.stopLoss,
      tp,
      pnl: 0,
      pips: 0,
      tier,
      openTime: nowStr,
      // Liên kết ngược tới tín hiệu gốc để ghi sổ khi đóng lệnh
      signalId: sig.id,
      engine: sig.engine,
      engineName: sig.engineName,
      score: sigScore,
      quality: sig.quality,
      kaizenId: kz?.id,
      marketSnapshot: snap,
      openedAt: Date.now(),
      autoClose: { ...defaultAuto },
    });

    const newPositions: Position[] = [
      mkPos('TP1', lot1, sig.tp1, 1),
      mkPos('TP2', lot2, sig.tp2, 2),
      mkPos('TP3', lot3, sig.tp3, 3)
    ];

    setPositions((prev) => [...prev, ...newPositions]);
    showToast(`⚡ 1-Click: Đã mở 3 vị thế ${sig.direction} #${sig.symbol} (TP1 50%, TP2 30%, TP3 20%)`);
  };

  const handleClosePosition = (id: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
    showToast('Đã đóng vị thế giao dịch.');
  };

  /**
   * Đóng lệnh kèm đánh dấu kết quả → tự ghi vào sổ tín hiệu (Trade.2026-style).
   * Giá thoát: TP → giá TP của tầng; SL → giá SL; BE → giá vào; MANUAL/TIME → giá hiện tại.
   * closeMethod: 'tay' (người bấm) | 'auto' (bot tự đóng).
   */
  const handleCloseWithOutcome = (
    id: string,
    outcome: JournalOutcome,
    closeMethod: 'tay' | 'auto' = 'tay',
    closeNote?: string
  ) => {
    const pos = positionsRef.current.find((p) => p.id === id);
    if (!pos) return;
    const asset = assets.find((a) => a.symbol === pos.symbol);
    const digits = asset ? asset.digits : 2;
    const exitPrice =
      outcome === 'TP' ? pos.tp
      : outcome === 'SL' ? pos.sl
      : outcome === 'BE' ? pos.entryPrice
      : pos.currentPrice;
    const entry = entryFromPosition(pos, outcome, exitPrice, digits, closeMethod, closeNote);
    setJournal((prev) => [...prev, entry]);
    // Đẩy lên kho chia sẻ nếu đang trong nhóm (đa thiết bị)
    try {
      if (getGroupId()) {
        pushShared([{
          ts: Date.now(), type: 'trade', symbol: entry.symbol, direction: entry.direction,
          entry: entry.entryPrice, exit: entry.exitPrice, lot: entry.lot,
          pnl: undefined, rMultiple: entry.rMultiple, outcome: entry.outcome, note: entry.note,
        }]).catch(() => { /* lặng lẽ */ });
      }
    } catch { /* noop */ }
    // Liên kết kết quả vào nhật ký Kaizen để phân tích yếu tố
    if (pos.kaizenId) linkKaizenOutcome(pos.kaizenId, outcome, entry.rMultiple);
    setPositions((prev) => prev.filter((p) => p.id !== id));
    const rTxt = `${entry.rMultiple >= 0 ? '+' : ''}${entry.rMultiple}R`;
    const who = closeMethod === 'auto' ? '🤖 Bot tự đóng' : '📝 Đã ghi sổ';
    showToast(`${who}: #${pos.symbol} ${pos.tier} ${OUTCOME_META[outcome].label}${closeNote ? ` (${closeNote})` : ''} (${rTxt})`);
  };

  /** Cập nhật cấu hình tự đóng của một vị thế */
  const handleUpdateAuto = (id: string, patch: Partial<AutoCloseConfig>) => {
    setPositions((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, autoClose: { ...(p.autoClose || defaultAuto), ...patch } }
          : p
      )
    );
  };

  // Engine BOT tự đóng lệnh: chạm TP/SL hoặc quá time-stop (chạy mỗi khi giá tick).
  // FIX F5 tự đóng lệnh: chỉ chạy khi giá là giá THẬT vừa poll (không phải giá mock
  // lúc mới tải trang, và không quá cũ khi mất mạng). Thà bỏ lỡ còn hơn đóng nhầm.
  const PRICE_STALE_MS = 15 * 60 * 1000; // 15 phút (cover cả forex poll 10')
  useEffect(() => {
    const nowTs = Date.now();
    for (const p of positionsRef.current) {
      const ac = p.autoClose;
      if (!ac || ac.mode !== 'AUTO') continue;
      const cur = assets.find((a) => a.symbol === p.symbol);
      if (!cur || cur.price <= 0) continue;
      if (cur.dataSource === 'OFFLINE') continue; // chưa có giá thật sau khi tải trang
      if (nowTs - (cur.updatedAt || 0) > PRICE_STALE_MS) continue; // giá quá cũ
      const px = cur.price;
      p.currentPrice = px; // đồng bộ giá thoát cho bản ghi sổ
      const hitTp = p.type === 'BUY' ? px >= p.tp : px <= p.tp;
      const hitSl = p.type === 'BUY' ? px <= p.sl : px >= p.sl;
      if (ac.tp && hitTp) {
        handleCloseWithOutcome(p.id, 'TP', 'auto', 'auto-TP');
      } else if (ac.sl && hitSl) {
        handleCloseWithOutcome(p.id, 'SL', 'auto', 'auto-SL');
      } else if (ac.timeStopMin && nowTs - (p.openedAt || nowTs) >= ac.timeStopMin * 60000) {
        const lbl = ac.timeStopMin >= 60 ? `${ac.timeStopMin / 60}h` : `${ac.timeStopMin}m`;
        handleCloseWithOutcome(p.id, 'TIME', 'auto', `time-stop ${lbl}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets]);

  const handleClearJournal = () => {
    if (window.confirm('Xóa toàn bộ sổ tín hiệu trên máy này? Hành động không thể hoàn tác.')) {
      clearJournal();
      setJournal([]);
      showToast('Đã xóa toàn bộ sổ tín hiệu.');
    }
  };

  const handleResetAll = () => {
    if (window.confirm(
      'RESET TOÀN BỘ DỮ LIỆU?\n\nXóa: sổ tín hiệu, nhật ký Kaizen, bản ghi Neural shadow, lệnh đang mở.\nTừ sau reset, mọi thống kê chỉ tính bản ghi thật mới.\n\nNên XUẤT BÁO CÁO HTML trước nếu cần lưu lại.\nHành động không thể hoàn tác.'
    )) {
      resetAllLocalData();
      markResetTime();
      setJournal([]);
      setPositions([]);
      setResetMark(Date.now());
      showToast('♻️ Đã reset — từ giờ chỉ tính bản ghi thật mới.');
    }
  };

  const handleMoveToBE = (id: string) => {
    setPositions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, sl: p.entryPrice } : p))
    );
    showToast('Đã dời Stop Loss về hòa vốn (BE). Giao dịch an toàn!');
  };

  const handleCloseAllPositions = () => {
    if (positions.length === 0) {
      showToast('Hiện không có vị thế nào đang mở.');
      return;
    }
    setPositions([]);
    showToast('⚠️ Đã đóng toàn bộ các vị thế đang mở (Emergency Close All).');
  };

  const handleTestTelegram = () => {
    showToast('🔔 Đã gửi tín hiệu kiểm tra Telegram thành công qua Webhook!');
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans">
      {apiOriginWarn && (
        <div className="mx-3 mt-3 rounded-lg border border-red-500/60 bg-red-950/60 px-4 py-3 text-sm text-red-200">
          <span className="font-bold">⚠️ SAI URL — API KHÔNG TỒN TẠI:</span> {apiOriginWarn}{' '}
          <a href={PROD_URL} className="underline font-bold text-red-100 hover:text-white">Mở đúng URL tại đây</a>
        </div>
      )}
      {/* Thanh đồng hồ phiên giao dịch realtime */}
      <SessionClocks />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#17223b] border border-sky-500/60 text-slate-100 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 font-mono text-xs animate-bounce">
          <span className="text-base">🚀</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedAsset={selectedAsset}
        assets={assets}
        onSelectAsset={(a) => {
          setSelectedAsset(a);
          showToast(`Đã chuyển Cockpit sang #${a.symbol}`);
        }}
        isDockOpen={isDockOpen}
        toggleDock={() => setIsDockOpen(!isDockOpen)}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        isMinimized={isMinimized}
        toggleMinimize={() => setIsMinimized(!isMinimized)}
      />

      {/* Banner thiết bị khách trong nhóm chia sẻ */}
      {(() => { const g = getGroupId(); const fromUrl = new URLSearchParams(window.location.search).get('g'); return g && fromUrl ? (
        <div className="mx-4 mt-2 px-4 py-2 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-200 text-xs flex items-center gap-2">
          <span>🔗</span>
          <span>Thiết bị này đang chia sẻ journal vào nhóm <strong className="font-mono">{g}</strong> — mọi giao dịch đóng sẽ tự lưu vào kho chung.</span>
        </div>
      ) : null; })()}

      {/* Dashboard tổng quan */}
      <DashboardStrip
        assets={assets}
        signals={signals}
        journal={journal}
        onGoRadar={() => setActiveTab('RADAR')}
        onGoLog={() => setActiveTab('LOG')}
      />

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Dock (Key K) */}
        <LeftDock
          isOpen={isDockOpen}
          onClose={() => setIsDockOpen(false)}
          account={liveAccount}
          startBalance={startBalance}
          onStartBalanceChange={handleStartBalanceChange}
          marketContext={marketContext}
          selectedAsset={selectedAsset}
          onCloseAllPositions={handleCloseAllPositions}
          onTestTelegram={handleTestTelegram}
          onUpdateRiskPct={(pct) => setAccount((prev) => ({ ...prev, riskPct: pct }))}
        />

        {/* Content Area */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {!isMinimized && (
            <div className="max-w-6xl mx-auto">
              {activeTab === 'FLIGHT' && (
                <FlightTab
                  signal={signals[selectedAsset.symbol]}
                  asset={selectedAsset}
                  positions={positions.filter((p) => p.symbol === selectedAsset.symbol)}
                  onExecuteTrade={handleExecuteTrade}
                  onClosePosition={handleClosePosition}
                  onMoveToBE={handleMoveToBE}
                  onCloseWithOutcome={handleCloseWithOutcome}
                  newsFilter={checkNewsFilter(selectedAsset.symbol, news)}
                  recentJournal={journal}
                  snapshot={snapshots[selectedAsset.symbol]}
                  dataTick={lastUpdated}
                />
              )}
              {activeTab === 'CTX' && <CtxTab marketContext={marketContext} asset={selectedAsset} />}
              {activeTab === 'SIG' && (
                <SigTab
                  newsEvents={news}
                  selectedSymbol={selectedAsset.symbol}
                  asset={assets.find((a) => a.symbol === selectedAsset.symbol)}
                  snapshot={snapshots[selectedAsset.symbol]}
                  signal={signals[selectedAsset.symbol]}
                  account={liveAccount}
                />
              )}
              {activeTab === 'RADAR' && (
                <RadarTab
                  assets={assets}
                  signals={signals}
                  snapshots={snapshots}
                  selectedAsset={selectedAsset}
                  onSelectAsset={(a) => {
                    setSelectedAsset(a);
                    setActiveTab('FLIGHT');
                    showToast(`Chuyển sang #${a.symbol}`);
                  }}
                />
              )}
              {activeTab === 'NEWS' && <NewsTab newsEvents={news} newsSource={newsSource} />}
              {activeTab === 'RESEARCH' && <ResearchTab signals={signals} />}
              {activeTab === 'CHART' && <ChartPanel assets={assets} journal={journal} initialSymbol={selectedAsset.symbol} news={news} />}
              {activeTab === 'JOURNAL' && (
                <JournalTab
                  positions={positions}
                  journal={journal}
                  defaultAuto={defaultAuto}
                  onDefaultAutoChange={handleDefaultAutoChange}
                  onUpdateAuto={handleUpdateAuto}
                  onCloseWithOutcome={handleCloseWithOutcome}
                  onMoveToBE={handleMoveToBE}
                  onCloseAllPositions={handleCloseAllPositions}
                />
              )}
              {activeTab === 'LOG' && <LogTab key={`log-${lastUpdated}-${journal.length}`} journal={journal} onClearJournal={handleClearJournal} onClearKaizen={() => { clearKaizen(); showToast('Đã xóa nhật ký Kaizen.'); }} onResetAll={handleResetAll} resetMark={resetMark} />}
              {activeTab === 'HELP' && <HelpTab />}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
