import { extractUsageFromDoc } from '../../../src/cli/docs';

describe('extractUsageFromDoc', () => {
  test('extracts Usage section and excludes Description and other headings', () => {
    const md = `# create
## Description
This creates a workflow
## Usage
raili create -w feature
More usage lines
## Examples
example here`;
    const res = extractUsageFromDoc(md);
    expect(res).toBe('raili create -w feature\nMore usage lines');
  });

  test('returns empty when no Usage section present', () => {
    const md = `# create\n## Description\nThis creates a workflow\n## Examples\nexample`;
    const res = extractUsageFromDoc(md);
    expect(res).toBe('');
  });

  test('trims top heading and handles single-line usage', () => {
    const md = `# create\n## Usage\nraili create -w feature\n# Other\nignored`;
    const res = extractUsageFromDoc(md);
    expect(res).toBe('raili create -w feature');
  });
});
