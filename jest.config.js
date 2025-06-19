module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./jest.setup.js'],
  testMatch: ['**/test/**/*.test.js'],
  collectCoverage: true,
  coverageReporters: ['text', 'lcov'],
};
