import {
  Fragment,
  createElement,
  useMemo,
  useState,
  type CSSProperties,
  type ComponentType,
  type PropsWithChildren,
  type ReactNode,
} from 'react';

type MotionValueListener<T> = (value: T) => void;

export class MotionValue<T> {
  private listeners = new Set<MotionValueListener<T>>();

  constructor(private value: T) {}

  get(): T {
    return this.value;
  }

  set(nextValue: T): void {
    if (Object.is(this.value, nextValue)) {
      return;
    }
    this.value = nextValue;
    this.listeners.forEach(listener => listener(nextValue));
  }

  onChange(listener: MotionValueListener<T>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export type Variants = Record<string, Record<string, unknown>>;

export const domAnimation = {};

export function LazyMotion({
  children,
}: PropsWithChildren<{features?: unknown}>) {
  return <>{children}</>;
}

export function AnimatePresence({
  children,
}: PropsWithChildren<{
  initial?: boolean;
  mode?: string;
}>) {
  return <>{children}</>;
}

export function useMotionValue<T>(initialValue: T): MotionValue<T> {
  return useMemo(() => new MotionValue(initialValue), [initialValue]);
}

export function useReducedMotion(): boolean {
  const [reducedMotion] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  return reducedMotion;
}

type MotionStyle = Record<string, unknown>;

type MotionComponentProps = {
  children?: ReactNode;
  style?: MotionStyle;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  variants?: Variants;
  transition?: unknown;
  layout?: boolean | string;
  whileHover?: unknown;
  whileTap?: unknown;
  whileFocus?: unknown;
  whileInView?: unknown;
  viewport?: unknown;
} & Record<string, unknown>;

type MotionValueLike = {
  get: () => unknown;
};

const MOTION_PROP_KEYS = new Set([
  'initial',
  'animate',
  'exit',
  'variants',
  'transition',
  'layout',
  'whileHover',
  'whileTap',
  'whileFocus',
  'whileInView',
  'viewport',
]);

function isMotionValueLike(value: unknown): value is MotionValueLike {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as MotionValueLike).get === 'function'
  );
}

function resolveMotionStyle(
  style: MotionStyle | undefined
): MotionStyle | undefined {
  if (!style) {
    return undefined;
  }

  const resolvedStyle: MotionStyle = {};
  Object.entries(style).forEach(([property, value]) => {
    resolvedStyle[property] = isMotionValueLike(value) ? value.get() : value;
  });
  return resolvedStyle;
}

function createMotionComponent(
  tagName: string
): ComponentType<MotionComponentProps> {
  return function MotionComponent(props: MotionComponentProps) {
    const {children, style, ...restProps} = props;
    const domProps: Record<string, unknown> = {};

    Object.entries(restProps).forEach(([key, value]) => {
      if (!MOTION_PROP_KEYS.has(key)) {
        domProps[key] = value;
      }
    });

    return createElement(
      tagName,
      {
        ...domProps,
        style: resolveMotionStyle(style) as CSSProperties | undefined,
      },
      children as ReactNode
    );
  };
}

const motionComponentCache = new Map<
  string,
  ComponentType<MotionComponentProps>
>();

export const m = new Proxy(
  {},
  {
    get(_target, property: string) {
      const tagName = String(property);
      const cached = motionComponentCache.get(tagName);
      if (cached) {
        return cached;
      }
      const component = createMotionComponent(tagName);
      motionComponentCache.set(tagName, component);
      return component;
    },
  }
) as Record<string, ComponentType<MotionComponentProps>>;

export const MotionConfig = Fragment;
