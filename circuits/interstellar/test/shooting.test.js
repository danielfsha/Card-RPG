#!/usr/bin/env node

/**
 * Test shooting circuit (main game circuit)
 */

const snarkjs = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');
const fs = require('fs');
const path = require('path');

async function testShooting() {
  console.log('🧪 Testing Shooting Circuit\n');

  const poseidon = await buildPoseidon();

  const testCases = [
    {
      name: 'Direct Hit (50 units)',
      shooter: { x: 100, y: 50, z: 0 },
      target: { x: 150, y: 50, z: 0 },
      direction: { x: 1000, y: 0, z: 0 },
      distance: 50,
      max_range: 100,
      expectedHit: true
    },
    {
      name: 'Miss (target off trajectory)',
      shooter: { x: 100, y: 50, z: 0 },
      target: { x: 150, y: 100, z: 0 },
      direction: { x: 1000, y: 0, z: 0 },
      distance: 70,
      max_range: 100,
      expectedHit: false
    },
    {
      name: 'Out of Range',
      shooter: { x: 0, y: 0, z: 0 },
      target: { x: 150, y: 0, z: 0 },
      direction: { x: 1000, y: 0, z: 0 },
      distance: 150,
      max_range: 100,
      expectedHit: false
    },
    {
      name: 'Diagonal Shot Hit',
      shooter: { x: 0, y: 0, z: 0 },
      target: { x: 50, y: 50, z: 0 },
      direction: { x: 707, y: 707, z: 0 }, // 45 degree angle
      distance: 70,
      max_range: 100,
      expectedHit: true
    }
  ];

  const wasmPath = path.join(__dirname, '..', 'build', 'shooting_js', 'shooting.wasm');

  if (!fs.existsSync(wasmPath)) {
    console.error('❌ WASM file not found. Please run "npm run compile:shooting" first.');
    process.exit(1);
  }

  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log('  Shooter:', testCase.shooter);
    console.log('  Target:', testCase.target);
    console.log('  Direction:', testCase.direction);
    console.log('  Distance:', testCase.distance);
    console.log('  Max Range:', testCase.max_range);
    console.log('  Expected:', testCase.expectedHit ? 'HIT' : 'MISS');

    // Generate commitments
    const shooterSalt = BigInt('0x1111111111111111');
    const targetSalt = BigInt('0x2222222222222222');

    const shooterInputs = [
      BigInt(testCase.shooter.x),
      BigInt(testCase.shooter.y),
      BigInt(testCase.shooter.z),
      shooterSalt
    ];
    const shooterCommitment = poseidon.F.toString(poseidon(shooterInputs));

    const targetInputs = [
      BigInt(testCase.target.x),
      BigInt(testCase.target.y),
      BigInt(testCase.target.z),
      targetSalt
    ];
    const targetCommitment = poseidon.F.toString(poseidon(targetInputs));

    const input = {
      shooter_x: String(testCase.shooter.x),
      shooter_y: String(testCase.shooter.y),
      shooter_z: String(testCase.shooter.z),
      target_x: String(testCase.target.x),
      target_y: String(testCase.target.y),
      target_z: String(testCase.target.z),
      shot_direction_x: String(testCase.direction.x),
      shot_direction_y: String(testCase.direction.y),
      shot_direction_z: String(testCase.direction.z),
      distance: String(testCase.distance),
      max_range: String(testCase.max_range),
      shooter_salt: shooterSalt.toString(),
      target_salt: targetSalt.toString(),
      shooter_commitment: shooterCommitment,
      target_commitment: targetCommitment
    };

    try {
      const startTime = Date.now();
      const { witness } = await snarkjs.wtns.calculate(input, wasmPath);
      const execTime = Date.now() - startTime;

      console.log(`  ✅ Circuit executed in ${execTime}ms`);
      console.log('  Witness length:', witness.length);
    } catch (err) {
      console.log('  ❌ Circuit execution failed:', err.message);
      console.error(err);
    }
  }

  console.log('\n✅ Shooting circuit tests complete!');
}

testShooting().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
