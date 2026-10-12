import { useState, useEffect, useMemo } from 'react';
import { fetchAllFred, FredSeries, FredSeriesId } from './fred';
import { fetchFredSnapshotOnline, pushFredSnapshot, lastFredPushAt, snapshotToSeries } from './fredStore';
import { computeDirectionScore, DirectionResult } from './directionScore';
import { Signal } from '../../types';

export const RESEARCH_SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'];

export interface FredSource {
  kind: 'online' | 'api' | 'cache';
  ageH: number | null;
  label: string;
}

/**
 * Hook: đọc FRED theo thứ tự ưu tiên —
 * 1. Kho ONLINE (nhánh data GitHub, dùng chung mọi thiết bị),
 * 2. API trực tiếp (nếu máy này có key),
 * 3. Cache localStorage.
 * Khi lấy được dữ liệu tươi qua API → tự đẩy snapshot lên kho online (nếu có PAT, tối đa 1 lần/6h).
 */
export function useDirectionScores(signals: Record<string, Signal>): {
  scores: Record<string, DirectionResult>;
  fred: Record<FredSeriesId, FredSeries> | null;
  fredLoaded: boolean;
  fredSource: FredSource;
} {
  const [fred, setFred] = useState<Record<FredSeriesId, FredSeries> | null>(null);
  const [source, setSource] = useState<FredSource>({ kind: 'cache', ageH: null, label: 'Đang tải…' });

  useEffect(() => {
    let alive = true;
    (async () => {
      // 1) Thử kho online trước (không cần key, dùng chung mọi máy)
      const online = await fetchFredSnapshotOnline();
      if (alive && online && online.ageH < 36) {
        setFred(snapshotToSeries(online.snap));
        setSource({ kind: 'online', ageH: online.ageH, label: `Kho online (${online.snap.asOf})` });
        return;
      }
      // 2) API trực tiếp (máy có key) → đẩy lên kho online cho máy khác dùng
      const data = await fetchAllFred();
      if (!alive) return;
      const hasData = Object.values(data).some((s) => !s.error && s.latest);
      if (hasData) {
        setFred(data);
        setSource({ kind: 'api', ageH: 0, label: 'API trực tiếp (máy này)' });
        // Đẩy lên kho online (tối đa 1 lần/6h, cần PAT GitHub)
        if (Date.now() - lastFredPushAt() > 6 * 3600 * 1000) {
          pushFredSnapshot(data, 'app-push').catch(() => { /* lặng lẽ */ });
        }
      } else if (online) {
        // online cũ (>36h) vẫn hơn không có gì
        setFred(snapshotToSeries(online.snap));
        setSource({ kind: 'online', ageH: online.ageH, label: `Kho online cũ (${online.snap.asOf})` });
      } else {
        setSource({ kind: 'cache', ageH: null, label: 'Chưa có dữ liệu' });
      }
    })();
    return () => { alive = false; };
  }, []);

  const scores = useMemo(() => {
    const out: Record<string, DirectionResult> = {};
    if (!fred) return out;
    for (const sym of RESEARCH_SYMBOLS) {
      const sig = signals[sym];
      out[sym] = computeDirectionScore({
        symbol: sym,
        fred,
        priceDirection: sig?.direction || 'FLAT',
        priceScore: sig?.scoreBreakdown ? sig.scoreBreakdown.reduce((s, f: any) => s + f.points, 0) : 0,
      });
    }
    return out;
  }, [fred, signals]);

  return { scores, fred, fredLoaded: !!fred, fredSource: source };
}
