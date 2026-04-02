import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ko', 'ja', 'zh-CN', 'es', 'de', 'fr', 'pt'],
  defaultLocale: 'en',
  localeDetection: true,
});
