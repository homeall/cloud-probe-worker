console.log('Running smoke test...');

// Simple test to verify Node.js is working
console.log('Node.js version:', process.version);

// Test basic module import
try {
  console.log('Importing module...');
  const module = await import('../src/index.js');
  console.log('Module imported successfully!');
  console.log('Exports:', Object.keys(module));
  
  // Test if fetch function exists
  const fetch = module.fetch || module.default?.fetch || module.default;
  if (typeof fetch === 'function') {
    console.log('✅ fetch function found');
  } else {
    console.error('❌ fetch function not found in module exports');
  }
  
  // Exit with success
  process.exit(0);
} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
}
