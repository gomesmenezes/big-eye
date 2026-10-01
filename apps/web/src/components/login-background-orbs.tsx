'use client';

interface LoginBackgroundOrbsProps {
  isSubmitting?: boolean;
}

export function LoginBackgroundOrbs({ isSubmitting = false }: LoginBackgroundOrbsProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      {/* Original ambient glows preserved */}
      <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-cyan-600/15 blur-3xl transition-opacity duration-700" />
      <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-teal-600/15 blur-3xl transition-opacity duration-700" />

      {/* Subtle modern cybernetic dot matrix grid with soft radial fade */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(rgba(34, 211, 238, 0.15) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage:
            'radial-gradient(ellipse 65% 55% at 50% 35%, #000 50%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 65% 55% at 50% 35%, #000 50%, transparent 100%)',
        }}
      />

      {/* Soft atmospheric center-top backlight beam */}
      <div
        className={`absolute top-0 left-1/2 -translate-x-1/2 h-[450px] w-[600px] rounded-full bg-gradient-to-b from-cyan-500/10 via-teal-500/5 to-transparent blur-3xl transition-opacity duration-700 ${
          isSubmitting ? 'opacity-90' : 'opacity-60'
        }`}
      />
    </div>
  );
}
