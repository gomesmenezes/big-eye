import { redirect } from 'next/navigation';

import { MeDTO } from '@big-eye/contracts';

import { AdminShell } from '../../../components/admin/admin-shell';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:3001').replace(/\/$/u, '');
}

async function getCurrentUserRole(): Promise<'user' | 'admin' | undefined> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return undefined;
  }

  const response = await fetch(`${getApiBaseUrl()}/me`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!response.ok) {
    return undefined;
  }

  const payload: unknown = await response.json();
  const parsed = MeDTO.safeParse(payload);
  return parsed.success ? parsed.data.role : undefined;
}

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const role = await getCurrentUserRole();

  if (role !== 'admin') {
    redirect('/dashboard');
  }

  return <AdminShell>{children}</AdminShell>;
}
