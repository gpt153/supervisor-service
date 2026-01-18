/**
 * Simple test to verify project scoping logic
 */

// Simulate different PROJECT_NAME values
const testCases = [
  {
    projectName: 'meta',
    keyPath: 'project/consilio/stripe_key',
    shouldAllow: true,
    description: 'Meta can access any project secret'
  },
  {
    projectName: 'meta',
    keyPath: 'meta/test/api_key',
    shouldAllow: true,
    description: 'Meta can access meta secrets'
  },
  {
    projectName: 'consilio',
    keyPath: 'project/consilio/stripe_key',
    shouldAllow: true,
    description: 'Consilio can access own secrets'
  },
  {
    projectName: 'consilio',
    keyPath: 'meta/test/api_key',
    shouldAllow: true,
    description: 'Consilio can access meta secrets'
  },
  {
    projectName: 'consilio',
    keyPath: 'project/openhorizon/aws_key',
    shouldAllow: false,
    description: 'Consilio CANNOT access OpenHorizon secrets'
  },
  {
    projectName: 'openhorizon',
    keyPath: 'project/consilio/stripe_key',
    shouldAllow: false,
    description: 'OpenHorizon CANNOT access Consilio secrets'
  },
];

// Test the scoping logic (same as in server.ts)
function isSecretAllowed(projectName, keyPath) {
  if (projectName === 'meta') {
    return true; // Meta has full access
  }

  const allowedPrefixes = [`project/${projectName}/`, 'meta/'];
  return allowedPrefixes.some(prefix => keyPath.startsWith(prefix));
}

// Run tests
console.log('Testing Project Scoping Logic');
console.log('==============================\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const result = isSecretAllowed(test.projectName, test.keyPath);
  const success = result === test.shouldAllow;

  console.log(`Test ${index + 1}: ${test.description}`);
  console.log(`  Project: ${test.projectName}`);
  console.log(`  KeyPath: ${test.keyPath}`);
  console.log(`  Expected: ${test.shouldAllow ? 'ALLOW' : 'DENY'}`);
  console.log(`  Result:   ${result ? 'ALLOW' : 'DENY'}`);
  console.log(`  Status:   ${success ? '✓ PASS' : '✗ FAIL'}`);
  console.log('');

  if (success) {
    passed++;
  } else {
    failed++;
  }
});

console.log('==============================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('==============================\n');

if (failed > 0) {
  process.exit(1);
}
