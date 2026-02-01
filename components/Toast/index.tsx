import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  m,
  AnimatePresence,
  useReducedMotion,
  type Variants,
} from 'framer-motion';
import {AlertTriangle, CheckCircle2, Info, XCircle} from 'lucide-react';
import {clsx} from 'clsx';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type ToastInput = {
  type: ToastType;
  message: string;
  duration?: number;
};

type Toast = ToastInput & {
  id: string;
  duration: number;
};

type ToastContextValue = {
  toasts: Toast[];
  pushToast: (toast: ToastInput) => void;
  dismissToast: (id: string) => void;
};

const DEFAULT_TOAST_DURATION_MS = 2600;
const TOAST_EASE_OUT: [number, number, number, number] = [0.32, 0.72, 0, 1];
const TOAST_EASE_IN: [number, number, number, number] = [0.4, 0, 1, 1];

const ToastContext = createContext<ToastContextValue | null>(null);

const getToastVariants = (reduceMotion: boolean): Variants => ({
  hidden: {
    opacity: 0,
    ...(reduceMotion ? {} : {y: 8, scale: 0.98}),
  },
  visible: {
    opacity: 1,
    ...(reduceMotion ? {} : {y: 0, scale: 1}),
    transition: {duration: reduceMotion ? 0.12 : 0.18, ease: TOAST_EASE_OUT},
  },
  exit: {
    opacity: 0,
    ...(reduceMotion ? {} : {y: -4, scale: 0.98}),
    transition: {duration: reduceMotion ? 0.08 : 0.12, ease: TOAST_EASE_IN},
  },
});

const TOAST_TONE: Record<
  ToastType,
  {
    icon: typeof CheckCircle2;
    iconClassName: string;
    badgeClassName: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    iconClassName: 'text-df-green',
    badgeClassName: 'bg-df-green/12',
  },
  error: {
    icon: XCircle,
    iconClassName: 'text-df-red',
    badgeClassName: 'bg-df-red/12',
  },
  warning: {
    icon: AlertTriangle,
    iconClassName: 'text-df-yellow',
    badgeClassName: 'bg-df-yellow/18',
  },
  info: {
    icon: Info,
    iconClassName: 'text-df-blue',
    badgeClassName: 'bg-df-blue/12',
  },
};

export function ToastProvider({children}: {children: ReactNode}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const pushToast = useCallback(
    (toast: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const duration = toast.duration ?? DEFAULT_TOAST_DURATION_MS;
      setToasts(prev => [...prev, {...toast, id, duration}]);
      if (duration > 0) {
        const timeoutId = window.setTimeout(() => dismissToast(id), duration);
        timersRef.current.set(id, timeoutId);
      }
    },
    [dismissToast]
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(timeoutId => clearTimeout(timeoutId));
      timers.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      toasts,
      pushToast,
      dismissToast,
    }),
    [toasts, pushToast, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

export function useToasts(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToasts must be used within a ToastProvider');
  }
  return context;
}

export function ToastViewport() {
  const {toasts, dismissToast} = useToasts();
  const reduceMotion = useReducedMotion() ?? false;
  const variants = useMemo(
    () => getToastVariants(reduceMotion),
    [reduceMotion]
  );

  return (
    <div
      className={clsx(
        'fixed bottom-4 right-4 z-modal flex flex-col gap-2 items-end pointer-events-none'
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence initial={false}>
        {toasts.map(toast => {
          const tone = TOAST_TONE[toast.type];
          const Icon = tone.icon;

          return (
            <m.div
              key={toast.id}
              layout
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={variants}
              className={clsx(
                'pointer-events-auto w-72 max-w-[calc(100vw-2rem)]',
                'flex items-start gap-2.5 px-3.5 py-3 rounded-xl border',
                'bg-white/95 text-df-ink border-black/8 shadow-popup-light',
                'dark:bg-df-dark-strong dark:text-white dark:border-white/8 dark:shadow-popup'
              )}
              role={toast.type === 'error' ? 'alert' : 'status'}
              onClick={() => dismissToast(toast.id)}
            >
              <span
                className={clsx(
                  'flex items-center justify-center w-7 h-7 rounded-full shrink-0',
                  tone.badgeClassName
                )}
              >
                <Icon
                  size={16}
                  className={tone.iconClassName}
                  aria-hidden="true"
                />
              </span>
              <span className="text-sm font-medium leading-snug">
                {toast.message}
              </span>
            </m.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
