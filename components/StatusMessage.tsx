import {useMemo} from 'react';
import {m, useReducedMotion, type Variants} from '@/utils/motion';
import {clsx} from 'clsx';

export type StatusType = 'success' | 'warning' | 'error' | 'info';

interface StatusMessageProps {
  type: StatusType;
  message: string;
  id?: string;
}

const getVariants = (reduceMotion: boolean): Variants => ({
  hidden: {
    opacity: 0,
    ...(reduceMotion ? {} : {y: 4}),
  },
  visible: {
    opacity: 1,
    ...(reduceMotion ? {} : {y: 0}),
    transition: {duration: reduceMotion ? 0.12 : 0.15, ease: 'easeOut'},
  },
  exit: {
    opacity: 0,
    ...(reduceMotion ? {} : {y: -4}),
    transition: {duration: reduceMotion ? 0.08 : 0.1, ease: 'easeIn'},
  },
});

const STATUS_CLASSES: Record<StatusType, string> = {
  success: 'status-message-success',
  error: 'status-message-error',
  warning: 'status-message-warning',
  info: 'status-message-info',
};

export function StatusMessage({type, message, id}: StatusMessageProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const variants = useMemo(() => getVariants(reduceMotion), [reduceMotion]);

  return (
    <m.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={variants}
      id={id}
      className={clsx('status-message', STATUS_CLASSES[type])}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      {message}
    </m.div>
  );
}
