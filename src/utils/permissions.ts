const HTTP_SCHEMES = new Set(['http:', 'https:']);

function isHttpProtocol(protocol: string): boolean {
  return HTTP_SCHEMES.has(protocol);
}

export function getOriginPattern(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!isHttpProtocol(parsed.protocol)) return null;
    return `${parsed.protocol}//${parsed.host}/*`;
  } catch {
    return null;
  }
}

function sitePatternToOriginPatterns(raw: string): string[] {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed.startsWith('#')) return [];

  let scheme: string | null = null;
  let host = '';

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      scheme = url.protocol.replace(':', '');
      host = url.host.toLowerCase();
    } catch {
      return [];
    }
  } else {
    const slashIndex = trimmed.indexOf('/');
    host = (slashIndex >= 0 ? trimmed.slice(0, slashIndex) : trimmed).trim();
  }

  if (!host) return [];

  const build = (protocol: string) => `${protocol}://${host}/*`;

  if (scheme) return [build(scheme)];
  if (host === '*') return ['http://*/*', 'https://*/*'];
  return [build('http'), build('https')];
}

export function siteListToOriginPatterns(list: string[]): string[] {
  const origins = list.flatMap((entry) => sitePatternToOriginPatterns(entry));
  return Array.from(new Set(origins));
}
