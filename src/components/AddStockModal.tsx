'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { X, Search } from 'lucide-react';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { searchStocks, popularStocks } from '@/lib/stockApi';
import { collectData } from '@/lib/analytics';

interface AddStockModalProps {
  onClose: () => void;
}

export default function AddStockModal({ onClose }: AddStockModalProps) {
  const t = useTranslations('addStock');
  const { stocks, addStock } = useWatchlistStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ ticker: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const res = await searchStocks(query);
      setResults(res);
      setLoading(false);
    }, 300);
  }, [query]);

  const handleAdd = (ticker: string, name: string) => {
    if (stocks.length >= 12) return;
    addStock(ticker, name);
    collectData('addStock', { ticker, name });
    onClose();
  };

  const maxReached = stocks.length >= 12;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="sa-card w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-sa-text">{t('title')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-sa-bg rounded">
            <X className="w-5 h-5 text-sa-text-secondary" />
          </button>
        </div>

        {maxReached && (
          <p className="text-sa-alert text-sm mb-4">{t('maxReached')}</p>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sa-text-secondary" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search')}
            className="w-full bg-sa-bg border border-sa-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-sa-text outline-none focus:border-sa-accent"
            disabled={maxReached}
          />
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1">
          {query && results.length > 0 ? (
            results.map((r) => {
              const alreadyAdded = stocks.some(s => s.ticker === r.ticker);
              return (
                <button
                  key={r.ticker}
                  onClick={() => !alreadyAdded && handleAdd(r.ticker, r.name)}
                  disabled={alreadyAdded || maxReached}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                    alreadyAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-sa-bg'
                  }`}
                >
                  <div>
                    <span className="text-sm font-medium text-sa-text">{r.ticker}</span>
                    <span className="text-xs text-sa-text-secondary ml-2">{r.name}</span>
                  </div>
                  {!alreadyAdded && <span className="text-xs text-sa-accent">{t('add')}</span>}
                </button>
              );
            })
          ) : !query ? (
            <>
              <p className="text-xs text-sa-text-secondary px-3 py-1 font-medium">{t('popular')}</p>
              {popularStocks.map((s) => {
                const alreadyAdded = stocks.some(st => st.ticker === s.ticker);
                return (
                  <button
                    key={s.ticker}
                    onClick={() => !alreadyAdded && handleAdd(s.ticker, s.name)}
                    disabled={alreadyAdded || maxReached}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                      alreadyAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-sa-bg'
                    }`}
                  >
                    <div>
                      <span className="text-sm font-medium text-sa-text">{s.ticker}</span>
                      <span className="text-xs text-sa-text-secondary ml-2">{s.name}</span>
                    </div>
                    {!alreadyAdded && <span className="text-xs text-sa-accent">{t('add')}</span>}
                  </button>
                );
              })}
            </>
          ) : loading ? (
            <p className="text-center text-sa-text-secondary text-sm py-4">...</p>
          ) : (
            <p className="text-center text-sa-text-secondary text-sm py-4">No results</p>
          )}
        </div>
      </div>
    </div>
  );
}
