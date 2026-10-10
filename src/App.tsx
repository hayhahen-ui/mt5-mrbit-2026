import React, { useState, useEffect } from 'react';
import { TabType, Asset, Signal, Position, AccountState, MarketContextState, JournalEntry, JournalOutcome } from './types';
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
import { LogTab } from './components/tabs/LogTab';
import { HelpTab } from './components/tabs/HelpTab';
import { loadJournal, saveJournal, clearJournal, entryFromPosition, OUTCOME_META } from './lib/journal';
import { checkNewsFilter, totalScore } from './lib/scoring';
import { useMarketData } from './hooks/useMarketData';
import { SessionClocks } from './components/SessionClocks';
import { DashboardStrip } from './components/DashboardStrip';
import { findLatestKaizenFor, linkKaizenOutcome, clearKaizen, loadKaizen } from './lib/kaizen';
import { resetAllLocalData, markResetTime, getResetMark } from './lib/reset';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('FLIGHT');
  const [account, setAccount] = useState<AccountState>(INITIAL_ACCOUNT);
  // Dữ liệu thị trường THẬT (hook tự poll + engine đánh giá tín hiệu)
  const { assets, signals, snapshots, news, newsSource, lastUpdated } = useMarketData(account.equity, account.riskPct);
  const [selectedAsset, setSelectedAsset] = useState<Asset>(assets[0]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [marketContext, setMarketContext] = useState<MarketContextState>(INITIAL_MARKET_CONTEXT);
  const [isDockOpen, setIsDockOpen] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  /** Sổ tín hiệu — persist localStorage, nguồn số liệu thật cho tab LOG */
  const [journal, setJournal] = useState<JournalEntry[]>(() => loadJournal());
  const [resetMark, setResetMark] = useState<number | null>(() => getResetMark());

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Lưu sổ xuống localStorage mỗi khi thay đổi
  useEffect(() => {
    saveJournal(journal);
  }, [journal]);

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
        case 'N': setActiveTab('NEWS'); break;
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
      marketSnapshot: snap
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
   * Giá thoát: TP → giá TP của tầng; SL → giá SL; BE → giá vào; MANUAL → giá hiện tại.
   */
  const handleCloseWithOutcome = (id: string, outcome: JournalOutcome) => {
    const pos = positions.find((p) => p.id === id);
    if (!pos) return;
    const asset = assets.find((a) => a.symbol === pos.symbol);
    const digits = asset ? asset.digits : 2;
    const exitPrice =
      outcome === 'TP' ? pos.tp
      : outcome === 'SL' ? pos.sl
      : outcome === 'BE' ? pos.entryPrice
      : pos.currentPrice;
    const entry = entryFromPosition(pos, outcome, exitPrice, digits);
    setJournal((prev) => [...prev, entry]);
    // Liên kết kết quả vào nhật ký Kaizen để phân tích yếu tố
    if (pos.kaizenId) linkKaizenOutcome(pos.kaizenId, outcome, entry.rMultiple);
    setPositions((prev) => prev.filter((p) => p.id !== id));
    const rTxt = `${entry.rMultiple >= 0 ? '+' : ''}${entry.rMultiple}R`;
    showToast(`📝 Đã ghi sổ: #${pos.symbol} ${pos.tier} ${OUTCOME_META[outcome].label} (${rTxt})`);
  };

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
          account={account}
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
              {activeTab === 'SIG' && <SigTab newsEvents={news} selectedSymbol={selectedAsset.symbol} />}
              {activeTab === 'RADAR' && (
                <RadarTab
                  assets={assets}
                  selectedAsset={selectedAsset}
                  onSelectAsset={(a) => {
                    setSelectedAsset(a);
                    setActiveTab('FLIGHT');
                    showToast(`Chuyển sang #${a.symbol}`);
                  }}
                />
              )}
              {activeTab === 'NEWS' && <NewsTab newsEvents={news} newsSource={newsSource} />}
              {activeTab === 'LOG' && <LogTab key={`log-${lastUpdated}-${journal.length}`} journal={journal} onClearJournal={handleClearJournal} onClearKaizen={() => { clearKaizen(); showToast('Đã xóa nhật ký Kaizen.'); }} onResetAll={handleResetAll} resetMark={resetMark} />}
              {activeTab === 'HELP' && <HelpTab />}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
