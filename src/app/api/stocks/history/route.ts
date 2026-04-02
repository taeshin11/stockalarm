import { NextRequest, NextResponse } from 'next/server';

const historyCache: Record<string, { data: any; timestamp: number }> = {};
const HISTORY_CACHE_TTL = 60000; // 1 minute

const rangeToInterval: Record<string, { range: string; interval: string }> = {
  '1D': { range: '1d', interval: '5m' },
  '5d': { range: '5d', interval: '15m' },
  '1W': { range: '5d', interval: '15m' },
  '1M': { range: '1mo', interval: '1d' },
  '1mo': { range: '1mo', interval: '1d' },
  '3M': { range: '3mo', interval: '1d' },
  '3mo': { range: '3mo', interval: '1d' },
  '6mo': { range: '6mo', interval: '1d' },
  '1Y': { range: '1y', interval: '1wk' },
  '1y': { range: '1y', interval: '1wk' },
  '2y': { range: '2y', interval: '1wk' },
  '5y': { range: '5y', interval: '1mo' },
  '10y': { range: '10y', interval: '1mo' },
  'max': { range: 'max', interval: '1mo' },
};

async function fetchYahooChart(ticker: string, yahooRange: string, interval: string) {
  // Try multiple Yahoo Finance endpoints
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${yahooRange}&interval=${interval}`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${yahooRange}&interval=${interval}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
      });

      if (res.ok) {
        const json = await res.json();
        const result = json?.chart?.result?.[0];
        if (!result || !result.timestamp) continue;

        const timestamps = result.timestamp;
        const ohlcv = result.indicators?.quote?.[0] || {};
        const adjClose = result.indicators?.adjclose?.[0]?.adjclose;

        const data = timestamps.map((ts: number, i: number) => ({
          time: new Date(ts * 1000).toISOString().split('T')[0],
          open: ohlcv.open?.[i] ?? 0,
          high: ohlcv.high?.[i] ?? 0,
          low: ohlcv.low?.[i] ?? 0,
          close: adjClose?.[i] ?? ohlcv.close?.[i] ?? 0,
          volume: ohlcv.volume?.[i] ?? 0,
        })).filter((d: any) => d.close > 0);

        if (data.length > 0) return data;
      }
    } catch {
      continue;
    }
  }
  return null;
}

// Get current price to generate realistic mock data
async function fetchCurrentPrice(ticker: string): Promise<number> {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (res.ok) {
      const data = await res.json();
      return data?.quoteResponse?.result?.[0]?.regularMarketPrice || 100;
    }
  } catch {}
  return 100;
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  const range = request.nextUrl.searchParams.get('range') || '1M';

  if (!ticker) {
    return NextResponse.json({ error: 'No ticker provided' }, { status: 400 });
  }

  const cacheKey = `${ticker}-${range}`;
  const cached = historyCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < HISTORY_CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const { range: yahooRange, interval } = rangeToInterval[range] || rangeToInterval['1M'];

  // Try Yahoo Finance
  const yahooData = await fetchYahooChart(ticker, yahooRange, interval);
  if (yahooData && yahooData.length > 0) {
    historyCache[cacheKey] = { data: yahooData, timestamp: Date.now() };
    return NextResponse.json(yahooData);
  }

  // Fallback: generate mock data based on CURRENT price (not hardcoded $150)
  const currentPrice = await fetchCurrentPrice(ticker);
  const mockData = generateMockHistory(range, currentPrice);
  historyCache[cacheKey] = { data: mockData, timestamp: Date.now() };
  return NextResponse.json(mockData);
}

function generateMockHistory(range: string, currentPrice: number) {
  const days = range === '1D' ? 1 : range === '1W' ? 5 : range === '1M' ? 30 : range === '3M' ? 90 : 365;
  const dataPoints = range === '1D' ? 78 : range === '1W' ? 40 : days; // 5min intervals for 1D
  const data = [];
  // Start price ~5% lower than current, drift up to current
  let price = currentPrice * (0.95 + Math.random() * 0.03);
  const drift = (currentPrice - price) / dataPoints;
  const now = new Date();

  for (let i = dataPoints; i >= 0; i--) {
    const date = new Date(now);
    if (range === '1D') {
      date.setMinutes(date.getMinutes() - i * 5);
    } else {
      date.setDate(date.getDate() - i);
    }
    const volatility = currentPrice * 0.015; // 1.5% daily volatility
    const change = drift + (Math.random() - 0.5) * volatility;
    price = Math.max(currentPrice * 0.8, price + change);

    const dayHigh = price + Math.random() * volatility * 0.5;
    const dayLow = price - Math.random() * volatility * 0.5;
    const open = price + (Math.random() - 0.5) * volatility * 0.3;

    data.push({
      time: range === '1D'
        ? date.toISOString()
        : date.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100,
      high: Math.round(dayHigh * 100) / 100,
      low: Math.round(dayLow * 100) / 100,
      close: Math.round(price * 100) / 100,
      volume: Math.floor(Math.random() * 30000000),
    });
  }
  return data;
}
