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
    <html className={`${inter.className} ${inter.variable}`} lang="pt-BR">
      <body className="min-h-screen bg-[#080a0f] text-[#f3f6fc] antialiased selection:bg-cyan-900/50 selection:text-cyan-200">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
