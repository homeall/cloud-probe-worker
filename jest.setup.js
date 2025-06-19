globalThis.import = new Proxy(globalThis.import, {
  apply(target, thisArg, args) {
    if (args[0] === 'meta') {
      return Promise.resolve({
        env: {
          VERSION: 'test-version',
          GIT_COMMIT: 'test-commit',
          BUILD_TIME: '2024-06-19'
        }
      });
    }
    return target.apply(thisArg, args);
  }
});
