#!/usr/bin/env node

/**
 * Copy circuit artifacts to frontend
 */

const fs = require('fs');
const path = require('path');

const CIRCUITS = ['shooting', 'damage', 'item_collection', 'win_condition'];
const BUILD_DIR = path.join(__dirname, '..', 'build');
const FRONTEND_DIR = path.join(__dirname, '..', '..', '..', 'interstellar-game', 'public', 'circuits');

console.log('📦 Copying circuit artifacts to frontend...\n');

// Create frontend circuits directory if it doesn't exist
if (!fs.existsSync(FRONTEND_DIR)) {
  fs.mkdirSync(FRONTEND_DIR, { recursive: true });
  console.log(`✅ Created directory: ${FRONTEND_DIR}\n`);
}

let successCount = 0;
let errorCount = 0;

CIRCUITS.forEach(circuit => {
  console.log(`📋 Copying ${circuit} artifacts...`);
  
  try {
    // Copy WASM file
    const wasmSrc = path.join(BUILD_DIR, `${circuit}_js`, `${circuit}.wasm`);
    const wasmDest = path.join(FRONTEND_DIR, `${circuit}.wasm`);
    
    if (fs.existsSync(wasmSrc)) {
      fs.copyFileSync(wasmSrc, wasmDest);
      console.log(`  ✅ ${circuit}.wasm`);
    } else {
      console.log(`  ❌ ${circuit}.wasm not found`);
      errorCount++;
    }
    
    // Copy zkey file
    const zkeySrc = path.join(__dirname, '..', `${circuit}_final.zkey`);
    const zkeyDest = path.join(FRONTEND_DIR, `${circuit}_final.zkey`);
    
    if (fs.existsSync(zkeySrc)) {
      fs.copyFileSync(zkeySrc, zkeyDest);
      console.log(`  ✅ ${circuit}_final.zkey`);
    } else {
      console.log(`  ❌ ${circuit}_final.zkey not found`);
      errorCount++;
    }
    
    // Copy verification key
    const vkeySrc = path.join(__dirname, '..', `${circuit}_verification_key.json`);
    const vkeyDest = path.join(FRONTEND_DIR, `${circuit}_verification_key.json`);
    
    if (fs.existsSync(vkeySrc)) {
      fs.copyFileSync(vkeySrc, vkeyDest);
      console.log(`  ✅ ${circuit}_verification_key.json`);
    } else {
      console.log(`  ❌ ${circuit}_verification_key.json not found`);
      errorCount++;
    }
    
    successCount++;
    console.log('');
  } catch (error) {
    console.error(`  ❌ Error copying ${circuit}: ${error.message}\n`);
    errorCount++;
  }
});

console.log('='.repeat(60));
if (errorCount === 0) {
  console.log(`✅ Successfully copied all artifacts for ${successCount} circuits!`);
  console.log(`\n📁 Destination: ${FRONTEND_DIR}`);
} else {
  console.log(`⚠️  Copied ${successCount} circuits with ${errorCount} errors`);
}
console.log('='.repeat(60));
