#!/usr/bin/env node

/**
 * Test item_collection circuit
 */

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

async function testItemCollection() {
  console.log('🧪 Testing Item Collection Circuit\n');

  const testCases = [
    {
      name: 'Health Pack Collection (within radius)',
      player: { x: 100, y: 50, z: 0 },
      item: { x: 105, y: 52, z: 0 },
      collection_radius: 10,
      item_type: 0,
      shouldCollect: true
    },
    {
      name: 'Ammo Collection (within radius)',
      player: { x: 100, y: 50, z: 0 },
      item: { x: 108, y: 50, z: 0 },
      collection_radius: 10,
      item_type: 1,
      shouldCollect: true
    },
    {
      name: 'Weapon Collection (within radius)',
      player: { x: 100, y: 50, z: 0 },
      item: { x: 100, y: 55, z: 0 },
      collection_radius: 10,
      item_type: 2,
      shouldCollect: true
    },
    {
      name: 'Item Too Far (outside radius)',
      player: { x: 100, y: 50, z: 0 },
      item: { x: 120, y: 50, z: 0 },
      collection_radius: 10,
      item_type: 0,
      shouldCollect: false
    },
    {
      name: 'Edge Case (exactly at radius)',
      player: { x: 0, y: 0, z: 0 },
      item: { x: 10, y: 0, z: 0 },
      collection_radius: 10,
      item_type: 1,
      shouldCollect: true
    }
  ];

  const wasmPath = path.join(__dirname, '..', 'build', 'item_collection_js', 'item_collection.wasm');

  if (!fs.existsSync(wasmPath)) {
    console.error('❌ WASM file not found. Please run "npm run compile:item" first.');
    process.exit(1);
  }

  const itemNames = ['Health Pack', 'Ammo', 'Weapon', 'Shield'];

  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log('  Player Position:', testCase.player);
    console.log('  Item Position:', testCase.item);
    console.log('  Collection Radius:', testCase.collection_radius);
    console.log('  Item Type:', itemNames[testCase.item_type]);
    console.log('  Expected:', testCase.shouldCollect ? 'COLLECT' : 'TOO FAR');

    const input = {
      player_x: String(testCase.player.x),
      player_y: String(testCase.player.y),
      player_z: String(testCase.player.z),
      item_x: String(testCase.item.x),
      item_y: String(testCase.item.y),
      item_z: String(testCase.item.z),
      collection_radius: String(testCase.collection_radius),
      item_type: String(testCase.item_type)
    };

    try {
      const startTime = Date.now();
      const { witness } = await snarkjs.wtns.calculate(input, wasmPath);
      const execTime = Date.now() - startTime;

      if (testCase.shouldCollect) {
        console.log(`  ✅ Circuit executed in ${execTime}ms (collection valid)`);
      } else {
        console.log(`  ⚠️  Circuit passed but item should be too far`);
      }
    } catch (err) {
      if (!testCase.shouldCollect) {
        console.log('  ✅ Circuit failed as expected (item too far)');
      } else {
        console.log('  ❌ Circuit execution failed:', err.message);
      }
    }
  }

  console.log('\n✅ Item collection circuit tests complete!');
}

testItemCollection().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
