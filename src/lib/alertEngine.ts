import { WatchlistStock, PriceData } from '@/store/useWatchlistStore';

export interface AlertResult {
  ticker: string;
  type: 'buy' | 'sell';
  targetPrice: number;
  currentPrice: number;
}

export function checkAlerts(
  stocks: WatchlistStock[],
  prices: Record<string, PriceData>
): AlertResult[] {
  const alerts: AlertResult[] = [];

  for (const stock of stocks) {
    if (!stock.targetPrice || stock.alertDismissed) continue;

    const priceData = prices[stock.ticker];
    if (!priceData) continue;

    const currentPrice = priceData.price;

    // Buy alert: price drops to or below target
    if (currentPrice <= stock.targetPrice && stock.targetPrice < priceData.previousClose) {
      alerts.push({
        ticker: stock.ticker,
        type: 'buy',
        targetPrice: stock.targetPrice,
        currentPrice,
      });
    }

    // Sell alert: price rises to or above target
    if (currentPrice >= stock.targetPrice && stock.targetPrice > priceData.previousClose) {
      alerts.push({
        ticker: stock.ticker,
        type: 'sell',
        targetPrice: stock.targetPrice,
        currentPrice,
      });
    }
  }

  return alerts;
}
