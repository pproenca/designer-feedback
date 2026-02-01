export function assertDomAvailable(context: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error(`${context} requires a DOM environment`);
  }
}

export function getWindow(context: string): Window {
  assertDomAvailable(context);
  return window;
}

export function getDocument(context: string): Document {
  assertDomAvailable(context);
  return document;
}

export function getNavigator(context: string): Navigator {
  assertDomAvailable(context);
  return navigator;
}
