module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
      '**/__tests__/unit/**/*.test.ts',
      '**/__tests__/integration/*.test.ts'
  ],
  collectCoverage: true,
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/src/cli\\.ts$',
    '<rootDir>/__tests__/unit/infrastructure/fsFake\\.util\\.ts$',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 90,
      lines: 85,
      statements: 85,
    }
  }
};
