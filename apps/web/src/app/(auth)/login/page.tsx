"use client";

import {
  Mail,
  Lock,
  User,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { ThinkingOrb } from "thinking-orbs";

import AcidSquares from "../../../components/acid-squares";
import { ElectricLogoWithFallback } from "../../../components/electric-logo";
import { LoginBackgroundOrbs } from "../../../components/login-background-orbs";
import {
  LoginTransitionOverlay,
  type LoginTransitionHandle,
} from "../../../components/login-transition-overlay";
import { OrbLoader } from "../../../components/orb-loader";
import { getSafeNextPath } from "../../../lib/auth-redirect";
import { createSupabaseBrowserClient } from "../../../lib/supabase/client";

type AuthMode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const transitionRef = useRef<LoginTransitionHandle>(null);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignup = mode === "signup";

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
        setNotice("Confira seu email para confirmar o cadastro.");
        setIsSubmitting(false);
        return;
      }

      // Wipe em camadas (estilo Staggered Menu) antes de navegar.
      // Mantém isSubmitting=true para a UI ficar em loading sob o wipe.
      await transitionRef.current?.playCover();

      const next =
        typeof window === "undefined"
          ? undefined
          : new URLSearchParams(window.location.search).get("next");
      router.replace(getSafeNextPath(next));
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível entrar.",
      );
      setIsSubmitting(false);
    }
  }

  function toggleMode() {
    setMode((currentMode) => (currentMode === "login" ? "signup" : "login"));
    setError(undefined);
    setNotice(undefined);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080a0f] px-4 py-12">
      {/* AcidSquares — fundo animado na paleta atual (ciano/teal), atrás de tudo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
      >
        <AcidSquares
          brightness={1.2}
          blur={0}
          color1="#0b3648"
          color2="#06b6d4"
          color3="#d9f8ff"
          colorShift={0}
          contrast={1.05}
          density={10.0}
          detail="medium"
          exposure={1900}
          glow={1.25}
          grain={true}
          grainIntensity={0.04}
          mouseInteraction={true}
          mouseRadius={0.7}
          mouseStrength={0.2}
          opacity={1}
          speed={0.6}
          spread={0.15}
          stepSize={0.002}
          waveDepth={1}
          zoom={1.3}
        />
      </div>
      {/* Véu leve + vinheta suave para legibilidade do card/orb */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-[#080a0f]/30"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_75%_65%_at_50%_45%,transparent_50%,rgba(8,10,15,0.55)_100%)]"
      />
      <LoginBackgroundOrbs isSubmitting={isSubmitting} />
      <LoginTransitionOverlay ref={transitionRef} />

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Núcleo sentinela — metade afundada atrás do card */}
        <div className="pointer-events-none absolute bottom-full left-1/2 z-0 -mb-16 flex -translate-x-1/2 origin-bottom scale-[0.85] flex-col items-center select-none sm:scale-100">
          <div className="relative flex h-56 w-56 items-center justify-center">
            {/* Halo em camadas */}
            <div className="absolute h-48 w-48 rounded-full bg-cyan-500/20 blur-2xl animate-pulse-subtle motion-reduce:animate-none" />
            <div className="absolute h-56 w-56 rounded-full bg-teal-500/10 blur-3xl" />

            {/* Base sólida do núcleo — dá corpo e profundidade à orb */}
            <div className="absolute h-44 w-44 rounded-full border border-cyan-300/20 bg-[#0a1424] shadow-[0_18px_50px_-12px_rgba(6,182,212,0.5),inset_0_0_28px_rgba(6,182,212,0.12)]" />
            {/* Reflexo superior */}
            <div className="absolute top-[30px] left-1/2 h-8 w-20 -translate-x-1/2 rounded-[100%] bg-cyan-100/10 blur-md" />

            {/* Anel orbital principal com satélite */}
            <div className="absolute h-52 w-52 animate-radar [animation-duration:14s] motion-reduce:animate-none">
              <div className="absolute inset-0 rounded-full border border-cyan-200/20" />
              <span className="absolute -top-[3px] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-cyan-200 shadow-[0_0_12px_2px_rgba(103,232,249,0.8)]" />
            </div>
            {/* Segundo anel inclinado */}
            <div className="absolute h-48 w-48 -rotate-12 scale-y-[0.62] rounded-full border border-teal-300/15" />

            {/* The Thinking Orb */}
            <ThinkingOrb
              color="#06b6d4"
              dots={1.35}
              size={64}
              speed={isSubmitting ? 1.6 : 0.85}
              state={isSubmitting ? "solving" : "connecting"}
              theme="dark"
              style={{
                width: 140,
                height: 140,
                filter: "drop-shadow(0 0 18px rgba(6, 182, 212, 0.45))",
              }}
            />
          </div>
        </div>

        {/* The Login Card - liquid glass (vidro fosco + rim ciano) */}
        <section className="login-glass relative z-10 w-full" aria-label={isSignup ? "Criar conta" : "Entrar"}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent" />
          <div className="relative z-10 p-8 sm:p-10">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="relative mb-2 flex h-36 w-64 items-center justify-center">
              <ElectricLogoWithFallback
                arcs={1}
                bend={0.6}
                className="electric-logo-fade-y"
                color="#cadcff"
                crackle={1.5}
                fallbackAlt="Big Eye Logo"
                fallbackSrc="/logo-full.png"
                glowColor="#22d3ee"
                interactive
                scale={0.7}
                speed={2.5}
                src="/logo-icon.png"
                strands={4}
              />
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
              {isSignup ? "Crie sua conta" : "Entre na sua conta"}
            </h1>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {isSignup ? (
              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
                  htmlFor="name"
                >
                  Nome
                </label>
                <div className="relative mt-1.5">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-3 pr-3 pl-10 text-xs text-white placeholder:text-slate-500 backdrop-blur-sm outline-none transition focus:border-cyan-400/60 focus:bg-white/[0.09] focus:ring-2 focus:ring-cyan-500/20"
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
              <label
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
                htmlFor="email"
              >
                Email
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  autoComplete="email"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-3 pr-3 pl-10 text-xs text-white placeholder:text-slate-500 backdrop-blur-sm outline-none transition focus:border-cyan-400/60 focus:bg-white/[0.09] focus:ring-2 focus:ring-cyan-500/20"
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
              <label
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
                htmlFor="password"
              >
                Senha
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-3 pr-3 pl-10 text-xs text-white placeholder:text-slate-500 backdrop-blur-sm outline-none transition focus:border-cyan-400/60 focus:bg-white/[0.09] focus:ring-2 focus:ring-cyan-500/20"
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
              <div
                className="flex items-start gap-2.5 rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-xs text-red-300"
                role="alert"
              >
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
              className="group relative flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 py-3.5 px-4 text-xs font-bold text-white shadow-glow transition-all hover:from-cyan-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <OrbLoader color="#ffffff" size={20} state="working" />
                  <span>
                    {isSignup ? "Criando conta..." : "Autenticando..."}
                  </span>
                </span>
              ) : (
                <>
                  <span>{isSignup ? "Criar conta" : "Entrar"}</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-white/10 pt-5 text-center">
            <button
              className="text-xs font-medium text-slate-400 transition hover:text-cyan-400"
              onClick={toggleMode}
              type="button"
            >
              {isSignup ? (
                <>
                  Já tem credencial?{" "}
                  <strong className="font-semibold text-cyan-400 underline">
                    Fazer login
                  </strong>
                </>
              ) : (
                <>
                  Novo?{" "}
                  <strong className="font-semibold text-cyan-400 underline">
                    Criar conta
                  </strong>
                </>
              )}
            </button>
          </div>
          </div>
        </section>
      </div>
    </main>
  );
}
