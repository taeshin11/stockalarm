import { Metadata } from 'next';

const BASE_URL = 'https://stockalarm.vercel.app';

export function generateSEO({
  title,
  description,
  path = '',
  locale = 'en',
}: {
  title: string;
  description: string;
  path?: string;
  locale?: string;
}): Metadata {
  const url = `${BASE_URL}/${locale}${path}`;

  return {
    title,
    description,
    metadataBase: new URL(BASE_URL),
    alternates: {
      canonical: url,
      languages: {
        'en': `${BASE_URL}/en${path}`,
        'ko': `${BASE_URL}/ko${path}`,
        'ja': `${BASE_URL}/ja${path}`,
        'zh-CN': `${BASE_URL}/zh-CN${path}`,
        'es': `${BASE_URL}/es${path}`,
        'de': `${BASE_URL}/de${path}`,
        'fr': `${BASE_URL}/fr${path}`,
        'pt': `${BASE_URL}/pt${path}`,
      },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'StockAlarm',
      type: 'website',
      locale,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
    authors: [{ name: 'THE ELIOT K FINANCIAL' }],
    creator: 'SPINAI',
    publisher: 'SPINAI',
  };
}

export function generateJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'StockAlarm',
    description: 'Free multi-chart stock price alert dashboard. Monitor up to 12 stocks with real-time alerts.',
    url: BASE_URL,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    author: {
      '@type': 'Organization',
      name: 'SPINAI',
    },
  };
}
