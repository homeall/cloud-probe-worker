const { runCLI } = require('@jest/core');
const path = require('path');

runCLI({
  config: path.join(__dirname, '../jest.config.js'),
  moduleNameMapper: {
    '^@cloudflare/workers-types$': path.join(__dirname, '../node_modules/@cloudflare/workers-types/dist/index.js')
  },
  extensionsToTreatAsEsm: ['.js']
}, [__dirname])
