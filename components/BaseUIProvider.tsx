import React, { createContext, useContext } from 'react';
import { Tooltip } from '@base-ui/react/tooltip';

interface BaseUIContextValue {
  /** Container element for portals (inside Shadow DOM) */
  portalContainer: HTMLElement | null;
}

const BaseUIContext = createContext<BaseUIContextValue>({ portalContainer: null });

/**
 * Hook to access the portal container for Base UI components.
 * Returns the container element inside the Shadow DOM where portals should render.
 */
export function usePortalContainer(): HTMLElement | null {
  const context = useContext(BaseUIContext);
  return context.portalContainer;
}

interface BaseUIProviderProps {
  children: React.ReactNode;
  /** Container element for portals (typically inside Shadow DOM) */
  portalContainer: HTMLElement | null;
}

/**
 * Provider for Base UI components.
 * - Wraps children with Tooltip.Provider for coordinated tooltip behavior
 * - Provides portal container context for Shadow DOM compatibility
 *
 * Note: Tooltip delay (850ms) is set on individual Tooltip.Trigger components,
 * not on the provider. The provider enables tooltip group behavior.
 */
export function BaseUIProvider({ children, portalContainer }: BaseUIProviderProps) {
  return (
    <BaseUIContext.Provider value={{ portalContainer }}>
      <Tooltip.Provider>{children}</Tooltip.Provider>
    </BaseUIContext.Provider>
  );
}

/**
 * Default tooltip delay in milliseconds.
 * Use this constant when setting delay on Tooltip.Trigger components.
 */
export const TOOLTIP_DELAY = 850;
