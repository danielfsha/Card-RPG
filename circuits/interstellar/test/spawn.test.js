#!/usr/bin/env node

/**
 * Test spawn circuit
 */

const snarkjs = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');
const fs = require('fs');
const path = require('path');

async function testSpawn() {
  console.log('🧪 Testing Spawn Circuit\n');

  const testCases = [
    {
      name: 'Player 1 Spawn',
      game_seed: BigInt('0x123456789abcdef'),
      player_address: BigInt('0x1111111111111111'),
      spawn_index: 0
    },
    {
      name: 'Player 2 Spawn',
      game_seed: BigInt('0x123456789abcdef'),
      player_address: BigInt('0x2222222222222222'),
      spawn_index: 1
    },
    {
      name: 'Different Game Seed',
      game_seed: BigInt('0xfedcba987654321'),
      player_address: BigInt('0x1111111111111111'),
      spawn_index: 0
    }
  ];

  const wasmPath = path.join(__dirname, '..', 'build', 'spawn_js', 'spawn.wasm');

  if (!fs.existsSync(wasmPath)) {
    console.error('❌ WASM file not found. Please run "npm run compile:spawn" first.');
    process.exit(1);
  }

  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log('  Game Seed:', testCase.game_seed.toString(16));
    console.log('  Player Address:', testCase.player_address.toString(16));
    console.log('  Spawn Index:', testCase.spawn_index);

    const input = {
      game_seed: testCase.game_seed.toString(),
      player_address: testCase.player_address.toString(),
      spawn_index: String(testCase.spawn_index)
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

  console.log('\n✅ Spawn circuit tests complete!');
}

testSpawn().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
