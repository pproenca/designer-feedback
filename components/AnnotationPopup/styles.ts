

import { clsx } from 'clsx';

export const BUTTON_BASE = [
  'px-4 py-2 text-xs font-medium rounded-lg border-none cursor-pointer',
  'transition-interactive',
  'focus-ring',
  'active:scale-[0.98]',
].join(' ');

export const BUTTON_SECONDARY = clsx(
  BUTTON_BASE,
  'bg-black/5 text-black/60 hover:bg-black/8 hover:text-black/75',
  'dark:bg-white/8 dark:text-white/70 dark:hover:bg-white/12 dark:hover:text-white/85'
);

export const ELEMENT_LABEL = clsx(
  'text-xs font-normal max-w-full overflow-hidden text-ellipsis whitespace-nowrap flex-1',
  'text-muted'
);
