import { wrapMermaidInHtml } from '../../../src/cli/htmlWrapper';

describe('html wrapper', () => {
  test('wraps mermaid syntax into an HTML document with CDN reference', () => {
    const mermaid = 'graph TD\nA-->B';
    const out = wrapMermaidInHtml(mermaid);
    expect(out).toEqual(expect.any(String));
    expect(out).toContain('<html');
    expect(out).toContain('mermaid');
    expect(out).toContain('graph TD');
    // Basic sanity: should include mermaid script tag
    expect(out).toMatch(/<script[^>]*src=["'][^"']*mermaid[^"']*["'][^>]*>/i);
  });
});
