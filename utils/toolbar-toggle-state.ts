export type ToolbarToggleStore = Record<string, boolean>;

export function isToolbarEnabledForTab(
  store: ToolbarToggleStore,
  tabId: number
): boolean {
  return store[String(tabId)] === true;
}

export function setToolbarEnabledForTab(
  store: ToolbarToggleStore,
  tabId: number,
  enabled: boolean
): ToolbarToggleStore {
  const key = String(tabId);

  if (enabled) {
    if (store[key] === true) {
      return store;
    }
    return {...store, [key]: true};
  }

  if (!store[key]) {
    return store;
  }

  const next: ToolbarToggleStore = {...store};
  delete next[key];
  return next;
}

export function clearToolbarEnabledForTab(
  store: ToolbarToggleStore,
  tabId: number
): ToolbarToggleStore {
  const key = String(tabId);
  if (!store[key]) {
    return store;
  }

  const next: ToolbarToggleStore = {...store};
  delete next[key];
  return next;
}
