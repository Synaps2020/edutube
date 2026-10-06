import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { getCurrentUser } from '@/lib/auth';
import { I18nProvider } from '@/lib/client/i18n-context';
import { SessionProvider } from '@/lib/client/session-context';
import { ToastProvider } from '@/lib/client/toast-context';
import { dirOf, getDictionary, normalizeLocale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: { default: 'EduTube', template: '%s | EduTube' },
  description: 'Plateforme pédagogique vidéo et audio du Ministère de l’Éducation nationale.',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestCookies = await cookies();
  const locale = normalizeLocale(requestCookies.get('locale')?.value);
  const user = await getCurrentUser();

  return (
    <html lang={locale} dir={dirOf(locale)}>
      <body>
        <I18nProvider locale={locale} dict={getDictionary(locale)}>
          <SessionProvider initialUser={user}>
            <ToastProvider>
              <Header />
              <main id="contenu" className="mx-auto min-h-[calc(100vh-18rem)] max-w-7xl px-4 py-8 sm:px-6">
                {children}
              </main>
              <Footer locale={locale} />
            </ToastProvider>
          </SessionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
