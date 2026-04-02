import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import '../globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'StockAlarm — Free Multi-Chart Price Alert Dashboard',
  description: 'Monitor up to 12 stocks simultaneously with real-time charts and instant price target alerts. Free forever.',
  metadataBase: new URL('https://stockalarm.vercel.app'),
  openGraph: {
    title: 'StockAlarm — Free Multi-Chart Price Alert Dashboard',
    description: 'Monitor up to 12 stocks with real-time alerts.',
    siteName: 'StockAlarm',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StockAlarm — Free Multi-Chart Price Alert Dashboard',
    description: 'Monitor up to 12 stocks with real-time alerts.',
  },
  robots: { index: true, follow: true },
  authors: [{ name: 'THE ELIOT K FINANCIAL' }],
  creator: 'SPINAI',
  publisher: 'SPINAI',
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'StockAlarm',
              description: 'Free multi-chart stock price alert dashboard.',
              url: 'https://stockalarm.vercel.app',
              applicationCategory: 'FinanceApplication',
              operatingSystem: 'Web',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              author: { '@type': 'Organization', name: 'SPINAI' },
            }),
          }}
        />
      </head>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
