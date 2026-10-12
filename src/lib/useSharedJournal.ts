import { useState, useEffect, useCallback } from 'react';
import { getGroupId, pullShared, SharedEntry } from '../lib/groupSync';

/**
 * useSharedJournal — Hook dùng chung cho mọi tab cần dữ liệu chia sẻ.
 * Tự fetch khi có nhóm, auto-refresh mỗi 30s.
 */
export function useSharedJournal() {
  const [entries, setEntries] = useState<SharedEntry[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const group = getGroupId();

  const refresh = useCallback(async () => {
    if (!group) return;
    setLoading(true);
    try {
      const d = await pullShared(group);
      setEntries(d.entries.sort((a, b) => b.ts - a.ts));
      setDevices(d.devices);
    } catch { /* lặng lẽ */ } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => {
    if (!group) return;
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [group, refresh]);

  // Tách vị thế mở và lệnh đã đóng từ thiết bị KHÁC
  const myDeviceId = (() => {
    try { return localStorage.getItem('nexuspilot-device-id') || ''; } catch { return ''; }
  })();
  const sharedOpens = entries.filter((e) => e.type === 'position_open' && e.deviceId !== myDeviceId);
  const sharedTrades = entries.filter((e) => e.type === 'trade' && e.deviceId !== myDeviceId);

  return { group, entries, devices, sharedOpens, sharedTrades, loading, refresh };
}
