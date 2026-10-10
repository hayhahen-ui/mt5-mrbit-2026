import React, { useMemo, useState } from 'react';
import { Radio, Zap, BookOpen, Brain, LayoutDashboard } from 'lucide-react';
import { Asset, Signal, JournalEntry } from '../types';
import { getNeuralMode } from '../lib/neural/observer';
import { countNeuralRecords } from '../lib/neural/repository';
import { DataSourcesPanel } from './DataSourcesPanel';

interface DashboardStripProps {
  assets: Asset[];
  signals: Record<string, Signal>;
  journal: JournalEntry[];
  onGoRadar: () => void;
  onGoLog: () => void;
}

const QUALITY_RANK: Record<string, number> = { Q5: 5, Q4: 4, Q3: 3, Q2: 2, Q1: 1 };

/** Dải dashboard tổng quan — cái nhìn 5 giây cho người dùng */
export const DashboardStrip: React.FC<DashboardStripProps> = ({ assets, signals, journal, onGoRadar, onGoLog }) => {
  const feedOk = assets.filter((a) => a.dataSource === 'LIVE' || a.dataSource === 'DAILY').length;
  const activeSigs = Object.values(signals).filter((s) => s.direction !== 'FLAT');
  const best = activeSigs.sort((a, b) => (QUALITY_RANK[b.quality] || 0) - (QUALITY_RANK[a.quality] || 0))[0];

  const todayR = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todays = journal.filter((j) => j.closeTime.slice(0, 10) === today);
    const r = todays.reduce((a, j) => a + j.rMultiple, 0);
    return { r: Number(r.toFixed(2)), n: todays.length };
  }, [journal]);

  const neuralMode = getNeuralMode();
  const neuralCount = countNeuralRecords();
  /** Bấm thẻ FEED để mở panel kiểm chứng nguồn dữ liệu */
  const [showSources, setShowSources] = useState(false);

  const cards = [
    {
      icon: <Radio size={16} className="text-emerald-400" />,
      label: 'FEED DỮ LIỆU',
      value: `${feedOk}/${assets.length}`,
      sub: 'mã có giá thật · bấm để xem nguồn',
      onClick: () => setShowSources((v) => !v),
    },
    {
      icon: <Zap size={16} className="text-amber-400" />,
      label: 'TÍN HIỆU HOẠT ĐỘNG',
      value: `${activeSigs.length}`,
      sub: best ? `mạnh nhất: #${best.symbol} ${best.quality}` : 'chưa có tín hiệu',
      onClick: onGoRadar,
    },
    {
      icon: <BookOpen size={16} className="text-sky-400" />,
      label: 'KẾT QUẢ HÔM NAY',
      value: `${todayR.r >= 0 ? '+' : ''}${todayR.r}R`,
      sub: `${todayR.n} lệnh đã đóng sổ`,
      valueCls: todayR.r >= 0 ? 'text-emerald-400' : 'text-rose-400',
      onClick: onGoLog,
    },
    {
      icon: <Brain size={16} className="text-purple-400" />,
      label: 'NEURAL SHADOW',
      value: neuralMode === 'shadow' ? 'BẬT' : 'TẮT',
      sub: `${neuralCount} bản ghi quan sát`,
      valueCls: neuralMode === 'shadow' ? 'text-purple-300' : 'text-slate-500',
      onClick: undefined,
    },
  ];

  return (
    <div className="px-4 md:px-6 pt-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <LayoutDashboard size={14} className="text-sky-400" />
          <span className="text-xs font-bold text-slate-300 tracking-wide">TỔNG QUAN NHANH</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map((c) => (
            <button
              key={c.label}
              onClick={c.onClick}
              disabled={!c.onClick}
              className={`glass-panel p-3.5 flex items-center gap-3 text-left transition-all ${
                c.onClick ? 'hover:border-sky-500/50 cursor-pointer hover:-translate-y-0.5' : 'cursor-default'
              }`}
            >
              <div className="p-2 rounded-lg bg-[#0b0f19] border border-[#1e2b48] shrink-0">{c.icon}</div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-semibold tracking-wide">{c.label}</div>
                <div className={`text-xl font-bold font-mono ${c.valueCls || 'text-slate-100'}`}>{c.value}</div>
                <div className="text-[10px] text-slate-500 truncate">{c.sub}</div>
              </div>
            </button>
          ))}
        </div>
        {showSources && (
          <div className="mt-3">
            <DataSourcesPanel onGoRadar={onGoRadar} />
          </div>
        )}
      </div>
    </div>
  );
};
