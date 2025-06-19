// Simple environment check
console.log('=== Environment Check ===');
console.log('Node.js version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);
console.log('Current directory:', process.cwd());

// Check if we can write to the filesystem
const fs = require('fs');
try {
  const testFile = './test-write.tmp';
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
  console.log('Filesystem access: ✓ Working');
} catch (e) {
  console.error('Filesystem access: ✗ Failed', e);
}

// Check if we can import modules
try {
  const path = require('path');
  console.log('Module import: ✓ Working');
  console.log('  - Path module version:', path.version);
} catch (e) {
  console.error('Module import: ✗ Failed', e);
}
