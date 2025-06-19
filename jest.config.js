export default {
  testEnvironment: 'node',
  setupFiles: ['./jest.setup.js'],
  testMatch: ['**/test/**/*.test.js'],
  collectCoverage: true,
  coverageReporters: ['text', 'lcov'],
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@cloudflare/workers-types).*)'
  ],
  moduleNameMapper: {
    '^@cloudflare/workers-types$': '<rootDir>/node_modules/@cloudflare/workers-types/dist/index.js'
  }
};
