#!/usr/bin/env node

/**
 * Test damage circuit
 */

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

async function testDamage() {
  console.log('🧪 Testing Damage Circuit\n');

  const testCases = [
    {
      name: 'Pistol Damage (15 HP)',
      old_health: 100,
      damage_amount: 15,
      new_health: 85,
      weapon_type: 0
    },
    {
      name: 'Rifle Damage (25 HP)',
      old_health: 100,
      damage_amount: 25,
      new_health: 75,
      weapon_type: 1
    },
    {
      name: 'Shotgun Damage (40 HP)',
      old_health: 100,
      damage_amount: 40,
      new_health: 60,
      weapon_type: 2
    },
    {
      name: 'Sniper Damage (50 HP)',
      old_health: 100,
      damage_amount: 50,
      new_health: 50,
      weapon_type: 3
    },
    {
      name: 'Fatal Damage',
      old_health: 30,
      damage_amount: 40,
      new_health: 0,
      weapon_type: 2
    },
    {
      name: 'Overkill Damage',
      old_health: 10,
      damage_amount: 50,
      new_health: 0,
      weapon_type: 3
    }
  ];

  const wasmPath = path.join(__dirname, '..', 'build', 'damage_js', 'damage.wasm');

  if (!fs.existsSync(wasmPath)) {
    console.error('❌ WASM file not found. Please run "npm run compile:damage" first.');
    process.exit(1);
  }

  const weaponNames = ['Pistol', 'Rifle', 'Shotgun', 'Sniper'];

  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log('  Old Health:', testCase.old_health);
    console.log('  Damage Amount:', testCase.damage_amount);
    console.log('  New Health:', testCase.new_health);
    console.log('  Weapon:', weaponNames[testCase.weapon_type]);

    const input = {
      old_health: String(testCase.old_health),
      damage_amount: String(testCase.damage_amount),
      new_health: String(testCase.new_health),
      weapon_type: String(testCase.weapon_type)
    };

    try {
      const startTime = Date.now();
      const { witness } = await snarkjs.wtns.calculate(input, wasmPath);
      const execTime = Date.now() - startTime;

      console.log(`  ✅ Circuit executed in ${execTime}ms`);
    } catch (err) {
      console.log('  ❌ Circuit execution failed:', err.message);
    }
  }

  console.log('\n✅ Damage circuit tests complete!');
}

testDamage().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
