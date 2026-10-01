import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['var(--font-inter)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        mineral: '#080a0f',
        eye: {
          bg: '#080a0f',
          surface: '#0d111a',
          card: '#111622',
          cardHover: '#161d2d',
          border: '#1c2436',
          borderHover: '#2a3752',
          muted: '#818ea7',
          cyan: '#06b6d4',
          teal: '#14b8a6',
          emerald: '#10b981',
          indigo: '#6366f1',
          blue: '#3b82f6',
        },
        petrol: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
          950: '#083344',
        },
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(0, 0, 0, 0.4)',
        card: '0 4px 20px -2px rgba(0, 0, 0, 0.6), 0 0 0 1px #1a2233',
        'card-hover': '0 8px 30px -4px rgba(6, 182, 212, 0.15), 0 0 0 1px #27364f',
        'card-accent': '0 0 25px -4px rgba(6, 182, 212, 0.2), 0 0 0 1px rgba(6, 182, 212, 0.4)',
        glow: '0 0 25px -2px rgba(6, 182, 212, 0.35)',
        'glow-teal': '0 0 25px -2px rgba(20, 184, 166, 0.35)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out forwards',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        radar: 'radarSweep 4s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        radarSweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
