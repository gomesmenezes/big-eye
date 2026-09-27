'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { createSupabaseBrowserClient } from '../../../lib/supabase/client';

type AuthMode = 'login' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignup = mode === 'signup';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setNotice(undefined);
    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const result = isSignup
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { name } },
          })
        : await supabase.auth.signInWithPassword({ email, password });

      if (result.error) {
        throw result.error;
      }

      if (isSignup && !result.data.session) {
        setNotice('Confira seu email para confirmar o cadastro.');
        return;
      }

      router.replace('/dashboard');
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Não foi possível entrar.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleMode() {
    setMode((currentMode) => (currentMode === 'login' ? 'signup' : 'login'));
    setError(undefined);
    setNotice(undefined);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Big Eye</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">
            {isSignup ? 'Crie sua conta' : 'Entre na sua conta'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Consulte dados com créditos e acompanhe cada resultado.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {isSignup ? (
            <label className="block text-sm font-medium text-slate-700" htmlFor="name">
              Nome
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                id="name"
                name="name"
                onChange={(event) => setName(event.target.value)}
                required
                type="text"
                value={name}
              />
            </label>
          ) : null}

          <label className="block text-sm font-medium text-slate-700" htmlFor="email">
            Email
            <input
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              id="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700" htmlFor="password">
            Senha
            <input
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              id="password"
              minLength={6}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p
              className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              role="status"
            >
              {notice}
            </p>
          ) : null}

          <button
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Aguarde...' : isSignup ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        <button
          className="mt-6 w-full text-sm font-medium text-blue-700 hover:text-blue-800"
          onClick={toggleMode}
          type="button"
        >
          {isSignup ? 'Já tenho uma conta' : 'Ainda não tenho conta'}
        </button>
      </section>
    </main>
  );
}
