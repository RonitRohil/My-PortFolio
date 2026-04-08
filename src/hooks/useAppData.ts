import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearLocalAppCaches,
  clearRemotePortfolioData,
  fetchPortfolioData,
  flushOfflineBuffer,
  getLocalStorageUsage,
  loadLegacyLocalData,
  persistPortfolioChanges,
} from "../lib/dataService";
import { normalizePortfolioData, INITIAL_DATA } from "../lib/storage";
import { PortfolioData } from "../types";

function mergePortfolioData(previous: PortfolioData, partial: Partial<PortfolioData>) {
  return normalizePortfolioData({
    ...previous,
    ...partial,
    investments: partial.investments ? { ...previous.investments, ...partial.investments } : previous.investments,
    settings: partial.settings ? { ...previous.settings, ...partial.settings } : previous.settings,
  });
}

export function useAppData() {
  const [data, setData] = useState<PortfolioData>(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [storageSize, setStorageSize] = useState(() => getLocalStorageUsage());
  const dataRef = useRef<PortfolioData>(INITIAL_DATA);

  const refreshStorageSize = useCallback(() => {
    setStorageSize(getLocalStorageUsage());
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const nextData = await fetchPortfolioData();
      dataRef.current = nextData;
      setData(nextData);
      setLastSync(new Date());
    } catch (error) {
      console.error("Failed to load from Supabase, falling back to local data:", error);
      const localData = loadLegacyLocalData() || normalizePortfolioData({});
      dataRef.current = localData;
      setData(localData);
    } finally {
      refreshStorageSize();
      setLoading(false);
    }
  }, [refreshStorageSize]);

  useEffect(() => {
    void loadAll();

    const onOnline = async () => {
      setSyncing(true);
      try {
        await flushOfflineBuffer();
        await loadAll();
      } finally {
        setSyncing(false);
      }
    };

    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [loadAll]);

  const updateData = useCallback((partial: Partial<PortfolioData>) => {
    const previous = dataRef.current;
    const next = mergePortfolioData(previous, partial);
    const keys = Object.keys(partial) as Array<keyof PortfolioData>;

    dataRef.current = next;
    setData(next);
    refreshStorageSize();

    if (keys.length === 0) return;

    void (async () => {
      setSyncing(true);
      try {
        await persistPortfolioChanges(previous, next, keys);
        setLastSync(new Date());
      } catch (error) {
        console.error("Failed to sync portfolio changes:", error);
      } finally {
        refreshStorageSize();
        setSyncing(false);
      }
    })();
  }, [refreshStorageSize]);

  const clearAllData = useCallback(async () => {
    await clearRemotePortfolioData();
    clearLocalAppCaches();
    const empty = normalizePortfolioData({});
    dataRef.current = empty;
    setData(empty);
    setLastSync(new Date());
    refreshStorageSize();
  }, [refreshStorageSize]);

  return {
    data,
    loading,
    syncing,
    lastSync,
    storageSize,
    loadAll,
    updateData,
    clearAllData,
  };
}
