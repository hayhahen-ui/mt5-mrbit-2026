import React from 'react';
import { TabType, Asset } from '../types';
import { Radio, Volume2, VolumeX, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  selectedAsset: Asset;
  assets: Asset[];
  onSelectAsset: (asset: Asset) => void;
  isDockOpen: boolean;
  toggleDock: () => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  isMinimized: boolean;
  toggleMinimize: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  selectedAsset,
  assets,
  onSelectAsset,
  isDockOpen,
  toggleDock,
  soundEnabled,
  setSoundEnabled,
  isMinimized,
  toggleMinimize
}) => {
  const tabs: { id: TabType; label: string; key: string }[] = [
    { id: 'FLIGHT', label: 'FLIGHT', key: 'F' },
    { id: 'CTX', label: 'CTX', key: 'X' },
    { id: 'SIG', label: 'SIG', key: 'S' },
    { id: 'RADAR', label: 'RADAR', key: 'D' },
    { id: 'NEWS', label: 'NEWS', key: 'N' },
    { id: 'LOG', label: 'LOG', key: 'L' },
    { id: 'HELP', label: 'HELP', key: 'H' }
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#111625]/95 backdrop-blur-md border-b border-[#1e2b48] px-4 py-2.5 flex items-center justify-between gap-4">
      {/* Brand & Left Dock Trigger */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleDock}
          title="Đóng/Mở Dock bên trái (Phím K)"
          className={`p-2 rounded-lg transition-colors border ${
            isDockOpen
              ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
              : 'bg-[#17223b] text-slate-400 hover:text-white border-[#243356]'
          }`}
        >
          {isDockOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xl">✈️</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wider text-sky-400 text-sm">NEXUSPILOT</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800 font-mono">v3.00 Pro</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono hidden sm:block">AI TRADING COCKPIT</div>
          </div>
        </div>

        {/* Live Feed Status */}
        <div className="hidden lg:flex items-center gap-1.5 ml-3 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 radar-pulse"></span>
          <span className="font-mono text-[11px] font-semibold">FEED LIVE</span>
        </div>
      </div>

      {/* Symbol Switcher Pill Bar */}
      <div className="hidden md:flex items-center gap-1 bg-[#0b0f19] p-1 rounded-lg border border-[#1e2b48]">
        {assets.slice(0, 5).map((a) => (
          <button
            key={a.symbol}
            onClick={() => onSelectAsset(a)}
            className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-all ${
              selectedAsset.symbol === a.symbol
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-[#17223b]'
            }`}
          >
            {a.symbol}
          </button>
        ))}
      </div>

      {/* Tabs Navigation */}
      <nav className="flex items-center gap-1 bg-[#0b0f19] p-1 rounded-lg border border-[#1e2b48]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === t.id
                ? 'bg-sky-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-[#17223b]'
            }`}
          >
            <span>{t.label}</span>
            <span className={`text-[10px] font-mono px-1 rounded ${activeTab === t.id ? 'bg-sky-600/40 text-slate-950' : 'text-slate-400'}`}>
              {t.key}
            </span>
          </button>
        ))}
      </nav>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          title="Âm thanh cảnh báo"
          className="p-2 rounded-lg bg-[#17223b] text-slate-400 hover:text-white border border-[#243356] transition-colors"
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <button
          onClick={toggleMinimize}
          title="Thu gọn Cockpit (Phím M)"
          className="p-2 rounded-lg bg-[#17223b] text-slate-400 hover:text-white border border-[#243356] transition-colors"
        >
          {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
        </button>
      </div>
    </header>
  );
};
