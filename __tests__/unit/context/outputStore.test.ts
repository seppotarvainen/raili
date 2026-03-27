import { filterOutput } from '../../../src/context/outputStore';

describe('outputStore.filterOutput', () => {
  it('extracts between marker and marker_end (case-insensitive)', () => {
    const out = `Intro text\n//SUMMARY//\n- Point A\n- Point B\n//SUMMARY_END//\nFooter notes`;
    const res = filterOutput(out, { store: true, marker: '//SUMMARY//', marker_end: '//SUMMARY_END//' });
    expect(res).toBe('- Point A\n- Point B');
  });

  it('extracts before marker_end when only marker_end provided', () => {
    const out = `Intro text\n//SUMMARY//\n- Point A\n//SUMMARY_END//\nFooter`;
    const res = filterOutput(out, { store: true, marker_end: '//SUMMARY_END//' });
    expect(res).toBe('Intro text\n//SUMMARY//\n- Point A');
  });

  it('falls back to full output when neither marker present', () => {
    const out = `Line1\nLine2\nLine3`;
    const res = filterOutput(out, { store: true });
    expect(res).toBe('Line1\nLine2\nLine3');
  });

  it('marker present but marker_end before marker -> behave like marker-only', () => {
    const out = `Header\nEND_MARKER\nBody line\nSTART_MARKER\nContent after start`;
    const res = filterOutput(out, { store: true, marker: 'START_MARKER', marker_end: 'END_MARKER' });
    expect(res).toBe('Content after start');
  });

  it('applies tail after extraction', () => {
    const out = `Head\nOUTPUT:\nL1\nL2\nL3\nL4`;
    const res = filterOutput(out, { store: true, marker: 'OUTPUT:', tail: 2 });
    expect(res).toBe('L3\nL4');
  });
});
