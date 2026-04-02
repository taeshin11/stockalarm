import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface StockTarget {
  buyPrice?: number;
  sellPrice?: number;
}

export interface WatchlistStock {
  ticker: string;
  name: string;
  targetPrice?: number;
  alertTriggered: boolean;
  alertDismissed: boolean;
  lastAlertTime?: number;
}

export interface PriceData {
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  previousClose: number;
  timestamp: number;
  marketOpen: boolean;
}

interface WatchlistState {
  stocks: WatchlistStock[];
  prices: Record<string, PriceData>;
  refreshInterval: number;
  alertSound: string;
  alertsEnabled: boolean;

  addStock: (ticker: string, name: string) => void;
  removeStock: (ticker: string) => void;
  setTargetPrice: (ticker: string, price: number | undefined) => void;
  triggerAlert: (ticker: string) => void;
  dismissAlert: (ticker: string) => void;
  updatePrices: (prices: Record<string, PriceData>) => void;
  setRefreshInterval: (interval: number) => void;
  setAlertSound: (sound: string) => void;
  setAlertsEnabled: (enabled: boolean) => void;
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      stocks: [],
      prices: {},
      refreshInterval: 30,
      alertSound: 'alert-1',
      alertsEnabled: true,

      addStock: (ticker, name) => {
        const { stocks } = get();
        if (stocks.length >= 12 || stocks.find(s => s.ticker === ticker)) return;
        set({ stocks: [...stocks, { ticker, name, alertTriggered: false, alertDismissed: false }] });
      },

      removeStock: (ticker) => {
        set({ stocks: get().stocks.filter(s => s.ticker !== ticker) });
      },

      setTargetPrice: (ticker, price) => {
        set({
          stocks: get().stocks.map(s =>
            s.ticker === ticker ? { ...s, targetPrice: price, alertTriggered: false, alertDismissed: false } : s
          ),
        });
      },

      triggerAlert: (ticker) => {
        const now = Date.now();
        set({
          stocks: get().stocks.map(s =>
            s.ticker === ticker && !s.alertDismissed && (!s.lastAlertTime || now - s.lastAlertTime > 30000)
              ? { ...s, alertTriggered: true, lastAlertTime: now }
              : s
          ),
        });
      },

      dismissAlert: (ticker) => {
        set({
          stocks: get().stocks.map(s =>
            s.ticker === ticker ? { ...s, alertTriggered: false, alertDismissed: true } : s
          ),
        });
      },

      updatePrices: (prices) => {
        set({ prices: { ...get().prices, ...prices } });
      },

      setRefreshInterval: (interval) => set({ refreshInterval: interval }),
      setAlertSound: (sound) => set({ alertSound: sound }),
      setAlertsEnabled: (enabled) => set({ alertsEnabled: enabled }),
    }),
    {
      name: 'stockalarm-watchlist',
      partialize: (state) => ({
        stocks: state.stocks,
        refreshInterval: state.refreshInterval,
        alertSound: state.alertSound,
        alertsEnabled: state.alertsEnabled,
      }),
    }
  )
);
