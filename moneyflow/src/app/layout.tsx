import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/shared/toaster';
import { ServiceWorker } from '@/components/layout/service-worker';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'MONEYFLOW',
    template: '%s · MONEYFLOW',
  },
  description: 'Personal finance that answers the only question that matters: what can I spend today?',
  applicationName: 'MONEYFLOW',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'MONEYFLOW',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#09090B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Dark is the product's default; the cookie only ever opts out of it.
  const theme = (await cookies()).get('mf_theme')?.value === 'light' ? 'light' : 'dark';

  return (
    <html lang="ro" className={`${theme} ${inter.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {children}
        <Toaster />
        <ServiceWorker />
      </body>
    </html>
  );
}
