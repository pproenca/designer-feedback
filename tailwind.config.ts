import type { Config } from 'tailwindcss';

export default {
  content: [
    './entrypoints/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'df-blue': '#3c82f7',
        'df-red': '#ff3b30',
        'df-green': '#34c759',
        'df-dark': '#1b1b1b',
        'df-dark-hover': '#242424',
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      boxShadow: {
        'toolbar': '0 6px 18px rgba(0, 0, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.2)',
        'toolbar-light': '0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.04)',
        'tooltip': '0 6px 16px rgba(0, 0, 0, 0.3)',
        'tooltip-light': '0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.04)',
        'marker': '0 2px 6px rgba(0, 0, 0, 0.2), inset 0 0 0 1px rgba(0, 0, 0, 0.04)',
        'panel': '0 8px 22px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.06)',
        'panel-light': '0 4px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)',
        'popup': '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        'popup-light': '0 4px 20px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)',
      },
      zIndex: {
        'overlay': '99997',
        'markers': '99998',
        'toolbar': '100000',
        'panel': '100001',
        'tooltip': '100002',
      },
      borderRadius: {
        'toolbar': '1.5rem',
        'button': '50%',
        'panel': '1rem',
        'tooltip': '0.75rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
