'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Mail, Lock, User, AlertCircle, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';

import { getSafeNextPath } from '../../../lib/auth-redirect';
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

      const next =
        typeof window === 'undefined'
          ? undefined
          : new URLSearchParams(window.location.search).get('next');
      router.replace(getSafeNextPath(next));
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080a0f] px-4 py-12">
      {/* Cyan/Blue ambient glow */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-cyan-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-teal-600/10 blur-3xl" />

      <section className="relative w-full max-w-[420px] rounded-2xl border border-[#1a2233] bg-[#0c1018] p-8 shadow-card backdrop-blur-sm sm:p-10">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="relative mb-2 flex items-center justify-center">
            <Image
              alt="Big Eye Logo"
              className="h-28 w-auto object-contain drop-shadow-[0_0_25px_rgba(6,182,212,0.35)]"
              height={140}
              priority
              src="/logo-full.png"
              width={160}
            />
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
            {isSignup ? 'Crie sua conta' : 'Entre na sua conta'}
          </h1>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {isSignup ? (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="name">
                Nome
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <User className="h-4 w-4" />
                </div>
                <input
                  className="w-full rounded-xl border border-[#1e293f] bg-[#101522] py-3 pr-3 pl-10 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  id="name"
                  name="name"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Seu nome completo"
                  required
                  type="text"
                  value={name}
                />
              </div>
            </div>
          ) : null}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="email">
              Email
            </label>
            <div className="relative mt-1.5">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <Mail className="h-4 w-4" />
              </div>
              <input
                autoComplete="email"
                className="w-full rounded-xl border border-[#1e293f] bg-[#101522] py-3 pr-3 pl-10 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                id="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="operador@bigeye.intel"
                required
                type="email"
                value={email}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="password">
              Senha
            </label>
            <div className="relative mt-1.5">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <Lock className="h-4 w-4" />
              </div>
              <input
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                className="w-full rounded-xl border border-[#1e293f] bg-[#101522] py-3 pr-3 pl-10 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                id="password"
                minLength={6}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
                type="password"
                value={password}
              />
            </div>
          </div>

          {error ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-xs text-red-300" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          ) : null}

          {notice ? (
            <div
              className="flex items-start gap-2.5 rounded-xl border border-emerald-900/60 bg-emerald-950/40 p-3 text-xs text-emerald-300"
              role="status"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <span>{notice}</span>
            </div>
          ) : null}

          <button
            className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 py-3.5 px-4 font-mono text-xs font-bold text-white shadow-glow transition-all hover:from-cyan-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Aguarde...</span>
              </>
            ) : (
              <>
                <span>{isSignup ? 'Criar conta' : 'Entrar'}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-[#1a2233] pt-5 text-center">
          <button
            className="text-xs font-medium text-slate-400 transition hover:text-cyan-400"
            onClick={toggleMode}
            type="button"
          >
            {isSignup ? (
              <>Já tem credencial? <strong className="font-semibold text-cyan-400 underline">Fazer login</strong></>
            ) : (
              <>Novo? <strong className="font-semibold text-cyan-400 underline">Criar conta</strong></>
            )}
          </button>
        </div>
      </section>
    </main>
  );
}
