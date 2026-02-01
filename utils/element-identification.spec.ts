// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { getElementPath, identifyElement } from './element-identification';

describe('element-identification', () => {
  it('builds readable element paths with ids and parents', () => {
    const container = document.createElement('section');
    const target = document.createElement('div');
    target.id = 'hero';
    container.appendChild(target);
    document.body.appendChild(container);

    const path = getElementPath(target, 2);
    expect(path).toContain('#hero');
    expect(path).toContain('section');
  });

  it('uses data attributes for element names when provided', () => {
    const target = document.createElement('div');
    target.dataset.element = 'Hero CTA';
    document.body.appendChild(target);

    const result = identifyElement(target);
    expect(result.name).toBe('Hero CTA');
  });

  it('labels svg icons inside buttons with text context', () => {
    const button = document.createElement('button');
    button.textContent = 'Submit';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    button.appendChild(svg);
    document.body.appendChild(button);

    const result = identifyElement(svg as unknown as HTMLElement);
    expect(result.name).toContain('icon in "Submit" button');
  });
});
