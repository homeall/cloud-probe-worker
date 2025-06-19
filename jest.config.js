export default {
  testEnvironment: 'node',
  setupFiles: ['./jest.setup.js'],
  testMatch: ['**/test/**/*.test.js'],
  collectCoverage: true,
  coverageReporters: ['text', 'lcov'],
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons']
  }
};
