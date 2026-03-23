import { filterOutput } from '../../src/context/outputStore';

describe('outputStore.filterOutput', () => {
  it('extracts after first marker (case-insensitive)', () => {
    const out = `Intro line\nsummary:\nLine A\nLine B\nmore`;
    const res = filterOutput(out, { store: true, marker: 'SUMMARY:' });
    expect(res).toBe('Line A\nLine B\nmore');
  });

  it('falls back to full output when marker not present', () => {
    const out = `Line1\nLine2\nLine3`;
    const res = filterOutput(out, { store: true, marker: 'SUMMARY:' });
    expect(res).toBe('Line1\nLine2\nLine3');
  });

  it('applies tail after extraction', () => {
    const out = `Head\nOUTPUT:\nL1\nL2\nL3\nL4`;
    const res = filterOutput(out, { store: true, marker: 'OUTPUT:', tail: 2 });
    expect(res).toBe('L3\nL4');
  });
});
