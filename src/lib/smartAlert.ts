import { WatchlistStock, PriceData } from '@/store/useWatchlistStore';

export async function checkSmartAlerts(
  stocks: WatchlistStock[],
  prices: Record<string, PriceData>
): Promise<{ ticker: string; reason: string }[]> {
  const results: { ticker: string; reason: string }[] = [];

  const stocksWithSmartAlerts = stocks.filter(s => s.smartAlert && !s.smartAlertTriggered);

  // Process one at a time to avoid rate limits
  for (const stock of stocksWithSmartAlerts) {
    const priceData = prices[stock.ticker];
    if (!priceData) continue;

    try {
      const res = await fetch('/api/smart-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: stock.smartAlert,
          stockData: {
            ticker: stock.ticker,
            price: priceData.price,
            change: priceData.change,
            changePercent: priceData.changePercent,
            high: priceData.high,
            low: priceData.low,
            volume: priceData.volume,
            previousClose: priceData.previousClose,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.triggered) {
          results.push({ ticker: stock.ticker, reason: data.reason });
        }
      }
    } catch {
      // Silent fail
    }
  }

  return results;
}
