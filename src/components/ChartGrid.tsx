'use client';

import { useWatchlistStore } from '@/store/useWatchlistStore';
import MiniChart from './MiniChart';
import { useTranslations } from 'next-intl';

interface ChartGridProps {
  onExpand: (ticker: string) => void;
}

export default function ChartGrid({ onExpand }: ChartGridProps) {
  const { stocks, prices } = useWatchlistStore();
  const t = useTranslations('chart');

  if (stocks.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-sa-text-secondary">{t('noStocks')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {stocks.map((stock) => (
        <MiniChart
          key={stock.ticker}
          stock={stock}
          priceData={prices[stock.ticker]}
          onExpand={() => onExpand(stock.ticker)}
        />
      ))}
    </div>
  );
}
