#!/usr/bin/env node

/**
 * Quick test to verify Buffer polyfill setup
 * Run with: node test-setup.js
 */

console.log('🔍 Testing Buffer polyfill setup...\n');

// Test 1: Check if buffer package is installed
try {
  require.resolve('buffer');
  console.log('✅ buffer package is installed');
} catch (e) {
  console.log('❌ buffer package NOT installed');
  console.log('   Run: bun add buffer');
  process.exit(1);
}

// Test 2: Check if stream-browserify is installed
try {
  require.resolve('stream-browserify');
  console.log('✅ stream-browserify package is installed');
} catch (e) {
  console.log('❌ stream-browserify package NOT installed');
  console.log('   Run: bun add stream-browserify');
  process.exit(1);
}

// Test 3: Check if util is installed
try {
  require.resolve('util');
  console.log('✅ util package is installed');
} catch (e) {
  console.log('❌ util package NOT installed');
  console.log('   Run: bun add util');
  process.exit(1);
}

// Test 4: Check if circomlibjs is installed
try {
  require.resolve('circomlibjs');
  console.log('✅ circomlibjs package is installed');
} catch (e) {
  console.log('❌ circomlibjs package NOT installed');
  console.log('   Run: bun add circomlibjs');
  process.exit(1);
}

// Test 5: Check if snarkjs is installed
try {
  require.resolve('snarkjs');
  console.log('✅ snarkjs package is installed');
} catch (e) {
  console.log('❌ snarkjs package NOT installed');
  console.log('   Run: bun add snarkjs');
  process.exit(1);
}

// Test 6: Check if circuit artifacts exist
const fs = require('fs');
const path = require('path');

const artifacts = [
  'public/circuits/poker_game.wasm',
  'public/circuits/poker_game_final.zkey',
  'public/circuits/verification_key.json',
];

let allArtifactsExist = true;
artifacts.forEach(artifact => {
  if (fs.existsSync(path.join(__dirname, artifact))) {
    console.log(`✅ ${artifact} exists`);
  } else {
    console.log(`❌ ${artifact} NOT found`);
    allArtifactsExist = false;
  }
});

if (!allArtifactsExist) {
  console.log('\n⚠️  Some circuit artifacts are missing');
  console.log('   Run the trusted setup:');
  console.log('   cd circuits/pocker && bash setup-trusted.sh');
}

// Test 7: Check vite.config.ts
const viteConfig = fs.readFileSync(path.join(__dirname, 'vite.config.ts'), 'utf-8');
if (viteConfig.includes('inject-buffer')) {
  console.log('✅ vite.config.ts has inject-buffer plugin');
} else {
  console.log('⚠️  vite.config.ts missing inject-buffer plugin');
}

if (viteConfig.includes('circomlibjs')) {
  console.log('✅ vite.config.ts includes circomlibjs in optimizeDeps');
} else {
  console.log('⚠️  vite.config.ts missing circomlibjs in optimizeDeps');
}

// Test 8: Check index.html
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
if (indexHtml.includes('window.global')) {
  console.log('✅ index.html has global polyfill');
} else {
  console.log('⚠️  index.html missing global polyfill');
}

console.log('\n✨ Setup verification complete!');
console.log('\nNext steps:');
console.log('1. Clear Vite cache: rm -rf node_modules/.vite');
console.log('2. Start dev server: bun run dev');
console.log('3. Open http://localhost:5173');
console.log('4. Check browser console for errors');
