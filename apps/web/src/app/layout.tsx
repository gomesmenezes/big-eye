import type { Metadata } from 'next';

import { Providers } from '../lib/query-client';

import './globals.css';

export const metadata: Metadata = {
  title: 'Big Eye',
  description: 'Consultas de dados com créditos.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
