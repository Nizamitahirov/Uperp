import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const locales = ['az', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'az';

export default getRequestConfig(async () => {
  const cookieLocale = cookies().get('NEXT_LOCALE')?.value as Locale | undefined;
  const locale = locales.includes(cookieLocale as Locale) ? (cookieLocale as Locale) : defaultLocale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
