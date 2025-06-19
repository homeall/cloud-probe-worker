// Simple script to verify Node.js environment
console.log('=== Node.js Environment Check ===');
console.log('Node.js version:', process.version);
console.log('Platform:', process.platform, process.arch);
console.log('Current directory:', process.cwd());

// Test basic functionality
try {
  const fs = require('fs');
  const path = require('path');
  
  console.log('\n=== Filesystem Access ===');
  const testFile = path.join(__dirname, 'test-temp-file.txt');
  fs.writeFileSync(testFile, 'test');
  console.log('Write test: ✓ Success');
  
  const content = fs.readFileSync(testFile, 'utf8');
  console.log('Read test:', content === 'test' ? '✓ Success' : '✗ Failed');
  
  fs.unlinkSync(testFile);
  console.log('Cleanup: ✓ Success');
  
  console.log('\n=== Module System ===');
  console.log('require() works: ✓ Yes');
  
  // Test ES modules
  import('node:path').then(mod => {
    console.log('Dynamic import works: ✓ Yes');
    console.log('  - Path module version:', mod.version || 'unknown');
  }).catch(e => {
    console.error('Dynamic import failed:', e);
  });
  
} catch (error) {
  console.error('Error during tests:', error);
  process.exit(1);
}
