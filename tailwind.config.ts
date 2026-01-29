import type { Config } from 'tailwindcss';

export default {
  content: [
    './entrypoints/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontSize: {
        // Custom sizes commonly used in the design system
        '2xs': ['0.625rem', { lineHeight: '1.4' }],   // 10px
        'xs': ['0.6875rem', { lineHeight: '1.4' }],   // 11px (override default)
        'sm': ['0.8125rem', { lineHeight: '1.5' }],   // 13px (override default)
      },
      borderRadius: {
        // Custom radii commonly used in the design system
        'xl': '0.625rem',   // 10px
        '2xl': '1.125rem',  // 18px
      },
    },
  },
} satisfies Config;
