import type { Config } from 'tailwindcss';

export default {
  content: [
    './entrypoints/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
} satisfies Config;
