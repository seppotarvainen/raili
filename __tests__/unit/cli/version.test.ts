describe('raili CLI --version', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('prints version and exits 0 when --version passed', async () => {
    // Arrange: set argv before requiring the module so the module captures the args at load time
    process.argv = ['node', 'raili', '--version'];

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
      throw new Error('EXIT:' + String(code));
    });
    const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const pkg = require('../../../package.json');
    const expected = pkg.version + '\n';

    // Act: require module (which reads process.argv at top-level) and call main
    let main: any;
    try {
      main = require('../../../src/cli').main;
      await main();
      // If main returns normally, fail the test
      throw new Error('Expected process.exit to be called');
    } catch (err: any) {
      // Assert: ensure the sentinel exit was thrown with code 0
      expect(String(err.message)).toBe('EXIT:0');
    } finally {
      // Assert output written
      expect(writeSpy).toHaveBeenCalledWith(expected);
      // cleanup
      exitSpy.mockRestore();
      writeSpy.mockRestore();
    }
  });
});
