import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        mineral: '#f3f1eb',
        petrol: {
          50: '#edf8f5',
          100: '#d4eee8',
          200: '#a9ddd2',
          300: '#74c7b8',
          400: '#3ba99a',
          500: '#17877e',
          600: '#12645f',
          700: '#0e514e',
          800: '#0b403e',
          900: '#083331',
          950: '#062523',
        },
      },
    },
  },
  plugins: [],
};

export default config;
