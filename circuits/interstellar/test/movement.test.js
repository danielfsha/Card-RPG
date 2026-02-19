#!/usr/bin/env node

/**
 * Test movement circuit
 */

const snarkjs = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');
const fs = require('fs');
const path = require('path');

async function testMovement() {
  console.log('🧪 Testing Movement Circuit\n');

  const poseidon = await buildPoseidon();

  const testCases = [
    {
      name: 'Valid Movement (10 units)',
      old_pos: { x: 100, y: 50, z: 0 },
      new_pos: { x: 110, y: 50, z: 0 },
      max_speed: 15,
      delta_time: 1000,
      shouldPass: true
    },
    {
      name: 'Valid Diagonal Movement',
      old_pos: { x: 100, y: 50, z: 0 },
      new_pos: { x: 107, y: 57, z: 0 },
      max_speed: 15,
      delta_time: 1000,
      shouldPass: true
    },
    {
      name: 'Invalid Movement (too fast)',
      old_pos: { x: 100, y: 50, z: 0 },
      new_pos: { x: 120, y: 50, z: 0 },
      max_speed: 15,
      delta_time: 1000,
      shouldPass: false
    }
  ];

  const wasmPath = path.join(__dirname, '..', 'build', 'movement_js', 'movement.wasm');

  if (!fs.existsSync(wasmPath)) {
    console.error('❌ WASM file not found. Please run "npm run compile:movement" first.');
    process.exit(1);
  }

  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log('  Old Position:', testCase.old_pos);
    console.log('  New Position:', testCase.new_pos);
    console.log('  Max Speed:', testCase.max_speed);
    console.log('  Delta Time:', testCase.delta_time, 'ms');

    // Generate commitments
    const oldSalt = BigInt('0x1111111111111111');
    const newSalt = BigInt('0x2222222222222222');

    const oldInputs = [
      BigInt(testCase.old_pos.x),
      BigInt(testCase.old_pos.y),
      BigInt(testCase.old_pos.z),
      oldSalt
    ];
    const oldCommitment = poseidon.F.toString(poseidon(oldInputs));

    const newInputs = [
      BigInt(testCase.new_pos.x),
      BigInt(testCase.new_pos.y),
      BigInt(testCase.new_pos.z),
      newSalt
    ];
    const newCommitment = poseidon.F.toString(poseidon(newInputs));

    const input = {
      old_x: String(testCase.old_pos.x),
      old_y: String(testCase.old_pos.y),
      old_z: String(testCase.old_pos.z),
      new_x: String(testCase.new_pos.x),
      new_y: String(testCase.new_pos.y),
      new_z: String(testCase.new_pos.z),
      old_salt: oldSalt.toString(),
      new_salt: newSalt.toString(),
      old_commitment: oldCommitment,
      new_commitment: newCommitment,
      max_speed: String(testCase.max_speed),
      delta_time: String(testCase.delta_time)
    };

    try {
      const startTime = Date.now();
      const { witness } = await snarkjs.wtns.calculate(input, wasmPath);
      const execTime = Date.now() - startTime;

      if (testCase.shouldPass) {
        console.log(`  ✅ Circuit executed in ${execTime}ms (as expected)`);
      } else {
        console.log(`  ⚠️  Circuit passed but should have failed`);
      }
    } catch (err) {
      if (!testCase.shouldPass) {
        console.log('  ✅ Circuit failed as expected');
      } else {
        console.log('  ❌ Circuit execution failed:', err.message);
      }
    }
  }

  console.log('\n✅ Movement circuit tests complete!');
}

testMovement().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
