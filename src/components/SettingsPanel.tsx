'use client';

import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { testSound } from '@/utils/sound';

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const t = useTranslations('settings');
  const { alertSound, refreshInterval, setAlertSound, setRefreshInterval } = useWatchlistStore();

  const sounds = [
    { id: 'alert-1', name: 'Rising Beep' },
    { id: 'alert-2', name: 'Urgent Pulse' },
    { id: 'alert-3', name: 'Soft Chime' },
  ];

  const intervals = [15, 30, 60];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="sa-card w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-sa-text">{t('title')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-sa-bg rounded">
            <X className="w-5 h-5 text-sa-text-secondary" />
          </button>
        </div>

        {/* Alert Sound */}
        <div className="mb-6">
          <label className="text-sm font-medium text-sa-text mb-2 block">{t('alertSound')}</label>
          <div className="space-y-2">
            {sounds.map((s) => (
              <div key={s.id} className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="alertSound"
                    checked={alertSound === s.id}
                    onChange={() => setAlertSound(s.id)}
                    className="accent-sa-accent"
                  />
                  <span className="text-sm text-sa-text">{s.name}</span>
                </label>
                <button
                  onClick={() => testSound(s.id)}
                  className="text-xs text-sa-accent hover:underline"
                >
                  {t('testSound')}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Refresh Interval */}
        <div className="mb-6">
          <label className="text-sm font-medium text-sa-text mb-2 block">{t('refreshInterval')}</label>
          <div className="flex gap-2">
            {intervals.map((i) => (
              <button
                key={i}
                onClick={() => setRefreshInterval(i)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  refreshInterval === i
                    ? 'bg-sa-accent text-white'
                    : 'bg-sa-bg text-sa-text-secondary hover:text-sa-text'
                }`}
              >
                {i}{t('seconds').charAt(0)}
              </button>
            ))}
          </div>
        </div>

        <button onClick={onClose} className="sa-btn-secondary w-full">
          {t('close')}
        </button>
      </div>
    </div>
  );
}
