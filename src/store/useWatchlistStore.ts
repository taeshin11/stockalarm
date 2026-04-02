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
  smartAlert?: string; // natural language condition
  smartAlertTriggered?: boolean;
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
  telegramChatId: string;
  telegramEnabled: boolean;

  addStock: (ticker: string, name: string) => void;
  removeStock: (ticker: string) => void;
  setTargetPrice: (ticker: string, price: number | undefined) => void;
  triggerAlert: (ticker: string) => void;
  dismissAlert: (ticker: string) => void;
  updatePrices: (prices: Record<string, PriceData>) => void;
  setRefreshInterval: (interval: number) => void;
  setAlertSound: (sound: string) => void;
  setAlertsEnabled: (enabled: boolean) => void;
  setTelegramChatId: (id: string) => void;
  setTelegramEnabled: (enabled: boolean) => void;
  setSmartAlert: (ticker: string, prompt: string | undefined) => void;
  triggerSmartAlert: (ticker: string) => void;
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      stocks: [],
      prices: {},
      refreshInterval: 30,
      alertSound: 'alert-1',
      alertsEnabled: true,
      telegramChatId: '',
      telegramEnabled: false,

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
      setTelegramChatId: (id) => set({ telegramChatId: id }),
      setTelegramEnabled: (enabled) => set({ telegramEnabled: enabled }),

      setSmartAlert: (ticker, prompt) => {
        set({
          stocks: get().stocks.map(s =>
            s.ticker === ticker ? { ...s, smartAlert: prompt, smartAlertTriggered: false } : s
          ),
        });
      },
      triggerSmartAlert: (ticker) => {
        set({
          stocks: get().stocks.map(s =>
            s.ticker === ticker ? { ...s, smartAlertTriggered: true } : s
          ),
        });
      },
    }),
    {
      name: 'stockalarm-watchlist',
      partialize: (state) => ({
        stocks: state.stocks,
        refreshInterval: state.refreshInterval,
        alertSound: state.alertSound,
        alertsEnabled: state.alertsEnabled,
        telegramChatId: state.telegramChatId,
        telegramEnabled: state.telegramEnabled,
      }),
    }
  )
);
