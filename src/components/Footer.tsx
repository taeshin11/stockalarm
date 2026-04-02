'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="border-t border-sa-border py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-sa-text-secondary">
        <div>
          {t('builtBy')} <span className="text-sa-text font-medium">SPINAI</span> &middot; &copy; {new Date().getFullYear()} {t('rights')}
        </div>
        <div className="flex items-center gap-4">
          <Link href="/how-to-use" className="hover:text-sa-text transition-colors">
            {t('howToUse')}
          </Link>
          <a href="mailto:taeshinkim11@gmail.com" className="hover:text-sa-text transition-colors">
            {t('feedback')}
          </a>
        </div>
      </div>
    </footer>
  );
}
