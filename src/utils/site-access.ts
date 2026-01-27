import type { SiteListMode } from '@/types';

export type SiteAccessSettings = {
  siteListMode: SiteListMode;
  siteList: string[];
};

type ParsedPattern = {
  hostPattern: string;
  pathPrefix: string | null;
};

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

function normalizePath(path: string): string | null {
  if (!path) return null;
  return path.startsWith('/') ? path : `/${path}`;
}

function parsePattern(raw: string): ParsedPattern | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.startsWith('#')) return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      return {
        hostPattern: url.hostname.toLowerCase(),
        pathPrefix: normalizePath(`${url.pathname}${url.search}`),
      };
    } catch {
      return null;
    }
  }

  const slashIndex = trimmed.indexOf('/');
  if (slashIndex >= 0) {
    const hostPattern = trimmed.slice(0, slashIndex).trim();
    if (!hostPattern) return null;
    return {
      hostPattern,
      pathPrefix: normalizePath(trimmed.slice(slashIndex)),
    };
  }

  return { hostPattern: trimmed, pathPrefix: null };
}

function matchHost(hostname: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern.startsWith('*.')) {
    const base = pattern.slice(2);
    return hostname === base || hostname.endsWith(`.${base}`);
  }
  return hostname === pattern;
}

export function normalizeSitePattern(raw: string): string | null {
  const parsed = parsePattern(raw);
  if (!parsed) return null;
  const host = parsed.hostPattern.trim();
  if (!host) return null;
  const path = parsed.pathPrefix ?? '';
  return `${host}${path}`.toLowerCase();
}

export function normalizeSiteList(list: string[]): string[] {
  const normalized = list
    .map(normalizeSitePattern)
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set(normalized));
}

export function parseSiteListInput(text: string): string[] {
  const raw = text.split('\n').map((line) => line.trim());
  return normalizeSiteList(raw);
}

export function formatSiteList(list: string[]): string {
  return normalizeSiteList(list).join('\n');
}

export function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return HTTP_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export function getHostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isUrlAllowed(url: string, settings: SiteAccessSettings): boolean {
  if (!isHttpUrl(url)) return false;
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  const path = `${parsed.pathname}${parsed.search}`;
  const patterns = normalizeSiteList(settings.siteList);

  const matches = patterns.some((rawPattern) => {
    const parsedPattern = parsePattern(rawPattern);
    if (!parsedPattern) return false;
    if (!matchHost(hostname, parsedPattern.hostPattern)) return false;
    if (parsedPattern.pathPrefix && !path.startsWith(parsedPattern.pathPrefix)) {
      return false;
    }
    return true;
  });

  return settings.siteListMode === 'allowlist' ? matches : !matches;
}
