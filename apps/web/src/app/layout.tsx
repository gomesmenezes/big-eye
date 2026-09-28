import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { Providers } from '../lib/query-client';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Big Eye | Plataforma de Consultas & Inteligência de Dados',
  description: 'Consultas estruturadas de dados com controle transparente de créditos e acompanhamento em tempo real.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={inter.className} lang="pt-BR">
      <body className="min-h-screen bg-mineral text-slate-900 antialiased selection:bg-petrol-100 selection:text-petrol-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
