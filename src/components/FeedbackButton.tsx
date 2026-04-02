'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageCircle, X, Send } from 'lucide-react';

export default function FeedbackButton() {
  const t = useTranslations('feedback');
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, email }),
      });
      if (res.ok) {
        setStatus('sent');
        setMessage('');
        setEmail('');
        setTimeout(() => {
          setIsOpen(false);
          setStatus('idle');
        }, 2000);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {isOpen && (
        <div className="sa-card p-4 mb-3 w-72 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-sa-text">{t('title')}</span>
            <button onClick={() => setIsOpen(false)} className="p-0.5 hover:bg-sa-bg rounded">
              <X className="w-4 h-4 text-sa-text-secondary" />
            </button>
          </div>

          {status === 'sent' ? (
            <p className="text-sa-up text-sm py-4 text-center">{t('thanks')}</p>
          ) : (
            <>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('message')}
                className="w-full bg-sa-bg border border-sa-border rounded-lg px-3 py-2 text-sm text-sa-text outline-none focus:border-sa-accent resize-none h-20 mb-2"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('email')}
                className="w-full bg-sa-bg border border-sa-border rounded-lg px-3 py-2 text-sm text-sa-text outline-none focus:border-sa-accent mb-3"
              />
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || status === 'sending'}
                className="sa-btn-primary w-full disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {t('send')}
              </button>
              {status === 'error' && (
                <p className="text-sa-alert text-xs mt-2">{t('error')}</p>
              )}
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 rounded-full bg-sa-accent text-white flex items-center justify-center shadow-lg hover:bg-blue-500 transition-all hover:scale-105"
      >
        <MessageCircle className="w-5 h-5" />
      </button>
    </div>
  );
}
