import { describe, it, expect } from 'vitest';
import {
  formatSiteList,
  isHttpUrl,
  isUrlAllowed,
  normalizeSiteList,
  normalizeSitePattern,
  parseSiteListInput,
} from './site-access';

const allowlistSettings = {
  siteListMode: 'allowlist' as const,
  siteList: ['example.com', '*.example.com/admin'],
};

describe('site-access', () => {
  it('normalizes and dedupes site list entries while skipping invalid lines', () => {
    const list = normalizeSiteList([
      ' Example.com ',
      '# comment',
      'HTTP://EXAMPLE.COM/ADMIN',
      '',
      'http://',
      'example.com',
      'example.com',
      '   ',
    ]);

    expect(list).toEqual(['example.com', 'example.com/admin']);
  });

  it('parses multiline input and formats it deterministically', () => {
    const parsed = parseSiteListInput('Example.com\n# note\nexample.com/admin');
    expect(parsed).toEqual(['example.com', 'example.com/admin']);

    const formatted = formatSiteList(parsed);
    expect(formatted).toBe('example.com\nexample.com/admin');
  });

  it('normalizes single patterns and rejects invalid entries', () => {
    expect(normalizeSitePattern('EXAMPLE.com/Admin')).toBe('example.com/admin');
    expect(normalizeSitePattern('# comment')).toBeNull();
    expect(normalizeSitePattern('http://')).toBeNull();
  });

  it('validates HTTP/HTTPS URLs only', () => {
    expect(isHttpUrl('https://example.com')).toBe(true);
    expect(isHttpUrl('http://example.com')).toBe(true);
    expect(isHttpUrl('chrome://extensions')).toBe(false);
    expect(isHttpUrl('not a url')).toBe(false);
  });

  it('allowlist only allows matching hosts and paths', () => {
    expect(isUrlAllowed('https://example.com', allowlistSettings)).toBe(true);
    expect(isUrlAllowed('https://sub.example.com/admin', allowlistSettings)).toBe(true);
    expect(isUrlAllowed('https://sub.example.com/other', allowlistSettings)).toBe(false);
  });

  it('blocklist blocks matches but ignores invalid patterns', () => {
    const settings = {
      siteListMode: 'blocklist' as const,
      siteList: ['ads.example.com', 'http://'],
    };

    expect(isUrlAllowed('https://ads.example.com', settings)).toBe(false);
    expect(isUrlAllowed('https://example.com', settings)).toBe(true);
  });
});
