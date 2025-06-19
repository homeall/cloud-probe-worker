export default {
  testEnvironment: 'node',
  setupFiles: ['./jest.setup.js'],
  testMatch: ['**/test/**/*.test.js', '**/test/**/*.mjs'],
  collectCoverage: true,
  coverageReporters: ['text', 'lcov'],
  extensionsToTreatAsEsm: ['.js', '.mjs'],
  moduleNameMapper: {
    '^@cloudflare/workers-types$': '<rootDir>/node_modules/@cloudflare/workers-types/dist/index.js'
  },
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons']
  },
  transform: {},
  transformIgnorePatterns: ['<rootDir>/node_modules/'],
  moduleDirectories: ['node_modules', 'src'],
  moduleFileExtensions: ['js', 'json', 'node', 'mjs'],
  testTimeout: 5000,
  modulePathIgnorePatterns: ['<rootDir>/node_modules/'],
  resolver: undefined,
  modulePaths: ['<rootDir>/src'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  }
};
