export interface StockQuote {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  previousClose: number;
  name: string;
  marketOpen: boolean;
}

export async function fetchStockPrices(tickers: string[]): Promise<Record<string, StockQuote>> {
  if (tickers.length === 0) return {};
  try {
    const res = await fetch(`/api/stocks?tickers=${tickers.join(',')}`);
    if (!res.ok) throw new Error('API error');
    return await res.json();
  } catch {
    return {};
  }
}

export interface HistoricalDataPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchHistoricalData(ticker: string, range: string = '1M'): Promise<HistoricalDataPoint[]> {
  try {
    const res = await fetch(`/api/stocks/history?ticker=${ticker}&range=${range}`);
    if (!res.ok) throw new Error('API error');
    return await res.json();
  } catch {
    return [];
  }
}

// Popular stocks for the "Add Stock" modal
export const popularStocks = [
  { ticker: 'AAPL', name: 'Apple Inc.' },
  { ticker: 'NVDA', name: 'NVIDIA Corporation' },
  { ticker: 'MSFT', name: 'Microsoft Corporation' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.' },
  { ticker: 'TSLA', name: 'Tesla Inc.' },
  { ticker: 'META', name: 'Meta Platforms Inc.' },
  { ticker: 'TSM', name: 'TSMC' },
  { ticker: 'AVGO', name: 'Broadcom Inc.' },
  { ticker: 'JPM', name: 'JPMorgan Chase' },
  { ticker: '005930.KS', name: 'Samsung Electronics' },
  { ticker: '000660.KS', name: 'SK Hynix' },
];

export async function searchStocks(query: string): Promise<{ ticker: string; name: string }[]> {
  if (!query || query.length < 1) return [];
  try {
    const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('API error');
    return await res.json();
  } catch {
    // Fallback: filter popular stocks
    const q = query.toUpperCase();
    return popularStocks.filter(s => s.ticker.includes(q) || s.name.toUpperCase().includes(q));
  }
}
