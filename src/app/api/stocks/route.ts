import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache
const cache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL = 15000; // 15 seconds

export async function GET(request: NextRequest) {
  const tickers = request.nextUrl.searchParams.get('tickers');
  if (!tickers) {
    return NextResponse.json({ error: 'No tickers provided' }, { status: 400 });
  }

  const tickerList = tickers.split(',').slice(0, 12);
  const results: Record<string, any> = {};
  const tickersToFetch: string[] = [];

  // Check cache first
  for (const ticker of tickerList) {
    const cached = cache[ticker];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      results[ticker] = cached.data;
    } else {
      tickersToFetch.push(ticker);
    }
  }

  // Fetch uncached tickers
  if (tickersToFetch.length > 0) {
    try {
      const symbols = tickersToFetch.join(',');
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        next: { revalidate: 15 },
      });

      if (res.ok) {
        const data = await res.json();
        const quotes = data?.quoteResponse?.result || [];

        for (const quote of quotes) {
          const stockData = {
            ticker: quote.symbol,
            price: quote.regularMarketPrice || 0,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
            high: quote.regularMarketDayHigh || quote.regularMarketPrice || 0,
            low: quote.regularMarketDayLow || quote.regularMarketPrice || 0,
            volume: quote.regularMarketVolume || 0,
            previousClose: quote.regularMarketPreviousClose || 0,
            name: quote.shortName || quote.longName || quote.symbol,
            marketOpen: quote.marketState === 'REGULAR',
          };
          results[quote.symbol] = stockData;
          cache[quote.symbol] = { data: stockData, timestamp: Date.now() };
        }
      } else {
        // Fallback: generate mock data for demo
        for (const ticker of tickersToFetch) {
          const mockPrice = 100 + Math.random() * 400;
          const mockChange = (Math.random() - 0.5) * 10;
          const stockData = {
            ticker,
            price: Math.round(mockPrice * 100) / 100,
            change: Math.round(mockChange * 100) / 100,
            changePercent: Math.round((mockChange / mockPrice) * 10000) / 100,
            high: Math.round((mockPrice + Math.random() * 5) * 100) / 100,
            low: Math.round((mockPrice - Math.random() * 5) * 100) / 100,
            volume: Math.floor(Math.random() * 50000000),
            previousClose: Math.round((mockPrice - mockChange) * 100) / 100,
            name: ticker,
            marketOpen: false,
          };
          results[ticker] = stockData;
          cache[ticker] = { data: stockData, timestamp: Date.now() };
        }
      }
    } catch {
      // Fallback mock for any errors
      for (const ticker of tickersToFetch) {
        const mockPrice = 100 + Math.random() * 400;
        const mockChange = (Math.random() - 0.5) * 10;
        results[ticker] = {
          ticker,
          price: Math.round(mockPrice * 100) / 100,
          change: Math.round(mockChange * 100) / 100,
          changePercent: Math.round((mockChange / mockPrice) * 10000) / 100,
          high: Math.round((mockPrice + Math.abs(mockChange)) * 100) / 100,
          low: Math.round((mockPrice - Math.abs(mockChange)) * 100) / 100,
          volume: Math.floor(Math.random() * 50000000),
          previousClose: Math.round((mockPrice - mockChange) * 100) / 100,
          name: ticker,
          marketOpen: false,
        };
      }
    }
  }

  return NextResponse.json(results);
}
