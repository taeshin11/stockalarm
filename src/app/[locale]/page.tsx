'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Settings, HelpCircle, TrendingUp, LayoutGrid, Target, Brain } from 'lucide-react';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { fetchStockPrices } from '@/lib/stockApi';
import { checkAlerts } from '@/lib/alertEngine';
import { collectData } from '@/lib/analytics';
import { playAlertSound } from '@/utils/sound';
import { sendTelegramAlert } from '@/lib/telegram';
import { checkSmartAlerts } from '@/lib/smartAlert';
import ChartGrid from '@/components/ChartGrid';
import AddStockModal from '@/components/AddStockModal';
import SettingsPanel from '@/components/SettingsPanel';
import FeedbackButton from '@/components/FeedbackButton';
import ExpandedChart from '@/components/ExpandedChart';
import Footer from '@/components/Footer';

export default function HomePage() {
  const t = useTranslations('hero');
  const tNav = useTranslations('nav');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [alertsActivated, setAlertsActivated] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const { stocks, prices, refreshInterval, alertSound, alertsEnabled, telegramEnabled, telegramChatId, updatePrices, triggerAlert } = useWatchlistStore();

  const fetchPrices = useCallback(async () => {
    if (stocks.length === 0) return;
    const tickers = stocks.map(s => s.ticker);
    const newPrices = await fetchStockPrices(tickers);
    if (Object.keys(newPrices).length > 0) {
      const priceData: Record<string, any> = {};
      for (const [ticker, quote] of Object.entries(newPrices)) {
        priceData[ticker] = {
          price: (quote as any).price,
          change: (quote as any).change,
          changePercent: (quote as any).changePercent,
          high: (quote as any).high,
          low: (quote as any).low,
          volume: (quote as any).volume,
          previousClose: (quote as any).previousClose,
          timestamp: Date.now(),
          marketOpen: (quote as any).marketOpen,
        };
      }
      updatePrices(priceData);
    }
  }, [stocks, updatePrices]);

  // Price polling
  useEffect(() => {
    fetchPrices();
    intervalRef.current = setInterval(fetchPrices, refreshInterval * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchPrices, refreshInterval]);

  // Alert checking
  useEffect(() => {
    if (!alertsEnabled) return;
    const alerts = checkAlerts(stocks, prices);
    for (const alert of alerts) {
      triggerAlert(alert.ticker);
      if (alertsActivated) {
        playAlertSound(alertSound);
      }
      if (telegramEnabled && telegramChatId) {
        sendTelegramAlert(telegramChatId, alert.ticker, alert.currentPrice, alert.targetPrice, alert.type);
      }
      collectData('alertTriggered', { ticker: alert.ticker, type: alert.type, targetPrice: alert.targetPrice, currentPrice: alert.currentPrice });
    }
  }, [prices, stocks, alertsEnabled, alertSound, alertsActivated, triggerAlert, telegramEnabled, telegramChatId]);

  // Smart alert checking (every 60s)
  useEffect(() => {
    if (!alertsEnabled || stocks.length === 0) return;

    const checkSmart = async () => {
      const results = await checkSmartAlerts(stocks, prices);
      for (const result of results) {
        triggerAlert(result.ticker);
        if (alertsActivated) {
          playAlertSound(alertSound);
        }
      }
    };

    const smartInterval = setInterval(checkSmart, 60000);
    // Initial check after 5s
    const initialTimeout = setTimeout(checkSmart, 5000);

    return () => {
      clearInterval(smartInterval);
      clearTimeout(initialTimeout);
    };
  }, [stocks, prices, alertsEnabled, alertsActivated, alertSound, triggerAlert]);

  const handleEnableAlerts = () => {
    setAlertsActivated(true);
    // Play a tiny sound to unlock audio context
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.01);
    } catch {}
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-sa-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-sa-accent" />
            <h1 className="text-lg font-bold text-sa-text">StockAlarm</h1>
          </div>
          <div className="flex items-center gap-2">
            {!alertsActivated && stocks.length > 0 && stocks.some(s => s.targetPrice != null) && (
              <button
                onClick={handleEnableAlerts}
                className="sa-btn-primary text-xs animate-pulse"
              >
                🔔 Enable Alerts
              </button>
            )}
            <button
              onClick={() => setShowAddModal(true)}
              className="sa-btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{tNav('addStock')}</span>
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="sa-btn-secondary"
            >
              <Settings className="w-4 h-4" />
            </button>
            <a href="how-to-use" className="sa-btn-secondary">
              <HelpCircle className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {stocks.length === 0 ? (
          <div className="flex flex-col items-center">
            {/* Hero */}
            <div className="flex flex-col items-center text-center pt-12 pb-10">
              <TrendingUp className="w-16 h-16 text-sa-accent/30 mb-6" />
              <h2 className="text-2xl font-bold text-sa-text mb-2">{t('title')} <span className="text-sa-accent">{t('titleAccent')}</span></h2>
              <p className="text-sa-text-secondary max-w-md mb-8">{t('subtitle')}</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="sa-btn-primary text-base px-8 py-3"
              >
                <Plus className="w-5 h-5" />
                {t('cta')}
              </button>
            </div>

            {/* Demo preview cards */}
            <div className="w-full max-w-4xl mx-auto mb-16">
              <p className="text-xs text-sa-text-secondary text-center mb-4 uppercase tracking-wider">Preview — your dashboard will look like this</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { ticker: 'AAPL', name: 'Apple Inc.', price: '198.36', change: '+1.24', pct: '+0.63%', up: true },
                  { ticker: 'NVDA', name: 'NVIDIA Corp.', price: '124.57', change: '+3.81', pct: '+3.16%', up: true },
                  { ticker: 'TSLA', name: 'Tesla Inc.', price: '271.48', change: '-4.32', pct: '-1.57%', up: false },
                  { ticker: 'MSFT', name: 'Microsoft', price: '428.50', change: '+0.92', pct: '+0.21%', up: true },
                ].map((demo) => (
                  <div key={demo.ticker} className="border border-sa-border rounded-lg p-3 bg-sa-card opacity-70 pointer-events-none select-none">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sa-text text-sm">{demo.ticker}</span>
                      <span className={`text-xs font-medium ${demo.up ? 'text-green-400' : 'text-red-400'}`}>{demo.pct}</span>
                    </div>
                    <div className="text-lg font-semibold text-sa-text mb-1">${demo.price}</div>
                    <div className={`text-xs ${demo.up ? 'text-green-400' : 'text-red-400'}`}>{demo.change}</div>
                    {/* Fake sparkline */}
                    <svg viewBox="0 0 100 30" className="w-full h-8 mt-2" preserveAspectRatio="none">
                      <polyline
                        fill="none"
                        stroke={demo.up ? '#22c55e' : '#ef4444'}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={demo.up
                          ? '0,22 10,20 20,24 30,18 40,20 50,15 60,17 70,12 80,14 90,10 100,8'
                          : '0,8 10,12 20,10 30,14 40,12 50,18 60,15 70,20 80,18 90,22 100,24'
                        }
                      />
                    </svg>
                    <p className="text-[10px] text-sa-text-secondary mt-1">{demo.name}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Features section */}
            <div className="w-full max-w-3xl mx-auto pb-16">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="border border-sa-border rounded-lg p-5 bg-sa-card text-center">
                  <LayoutGrid className="w-8 h-8 text-sa-accent mx-auto mb-3" />
                  <h3 className="font-semibold text-sa-text mb-1">Multi-Chart Grid</h3>
                  <p className="text-sm text-sa-text-secondary">Monitor up to 12 stocks at once in a responsive grid layout.</p>
                </div>
                <div className="border border-sa-border rounded-lg p-5 bg-sa-card text-center">
                  <Target className="w-8 h-8 text-sa-accent mx-auto mb-3" />
                  <h3 className="font-semibold text-sa-text mb-1">Price Alerts</h3>
                  <p className="text-sm text-sa-text-secondary">Set target prices and get visual + audio alerts when they hit.</p>
                </div>
                <div className="border border-sa-border rounded-lg p-5 bg-sa-card text-center">
                  <Brain className="w-8 h-8 text-sa-accent mx-auto mb-3" />
                  <h3 className="font-semibold text-sa-text mb-1">AI Smart Alerts</h3>
                  <p className="text-sm text-sa-text-secondary">Natural language conditions powered by Gemini AI.</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <ChartGrid onExpand={setExpandedTicker} />
        )}
      </main>

      <Footer />

      {/* Modals */}
      {showAddModal && <AddStockModal onClose={() => setShowAddModal(false)} />}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {expandedTicker && <ExpandedChart ticker={expandedTicker} onClose={() => setExpandedTicker(null)} />}
      <FeedbackButton />
    </div>
  );
}
