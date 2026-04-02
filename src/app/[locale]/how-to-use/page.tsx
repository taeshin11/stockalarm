'use client';

import { useTranslations } from 'next-intl';
import { ArrowLeft, Plus, Target, Bell } from 'lucide-react';
import Link from 'next/link';
import Footer from '@/components/Footer';

export default function HowToUsePage() {
  const t = useTranslations('howToUse');

  const steps = [
    { icon: Plus, title: t('step1Title'), desc: t('step1Desc'), color: 'text-sa-accent' },
    { icon: Target, title: t('step2Title'), desc: t('step2Desc'), color: 'text-sa-alert' },
    { icon: Bell, title: t('step3Title'), desc: t('step3Desc'), color: 'text-sa-up' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 flex-1">
        <Link href="/" className="inline-flex items-center gap-2 text-sa-text-secondary hover:text-sa-text mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t('backHome')}
        </Link>

        <h1 className="text-3xl font-bold text-sa-text mb-12">{t('title')}</h1>

        <div className="space-y-8">
          {steps.map((step, i) => (
            <div key={i} className="sa-card p-6 flex gap-5">
              <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-sa-bg flex items-center justify-center ${step.color}`}>
                <step.icon className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs text-sa-text-secondary mb-1 font-medium">Step {i + 1}</div>
                <h3 className="text-lg font-semibold text-sa-text mb-2">{step.title}</h3>
                <p className="text-sa-text-secondary leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
