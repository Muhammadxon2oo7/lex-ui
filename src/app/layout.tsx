import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'LexSim - virtual huquqiy amaliyot', template: '%s · LexSim' },
  description:
    'Huquqshunoslik talabalari uchun 3D amaliyot simulyatori: real ish joyi, jonli fuqaro personaji va 6 mezonli manbali baho.',
  applicationName: 'LexSim',
  openGraph: {
    type: 'website',
    locale: 'uz_UZ',
    siteName: 'LexSim',
    title: 'LexSim - virtual huquqiy amaliyot',
    description: 'Bitta ishni maslahatdan sud qarorigacha 3D xonalarda yuritib chiqing: moddalar lex.uz saytidan, har qadam tahlili bilan.',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: '#f5f5f7', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="uz" className="h-full">
      {/* browser extensions (e.g. colour pickers) add attributes to <body> before hydration */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
