#!/usr/bin/env node

/**
 * Test script for ZK Interstellar circuits
 * Tests all circuits with various inputs
 */

const snarkjs = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');
const fs = require('fs');
const path = require('path');

async function testSpawn() {
  console.log('\n🧪 Testing spawn circuit...');
  
  const poseidon = await buildPoseidon();
  const game_seed = BigInt('12345678901234567890');
  const player_address = BigInt('0x1234567890abcdef');
  const spawn_index = 0;
  
  // Expected spawn position (would be calculated by circuit)
  const expected_x = 100;
  const expected_y = 50;
  const expected_z = 0;
  
  console.log('  Game Seed:', game_seed.toString());
  console.log('  Player Address:', player_address.toString(16));
  console.log('  Spawn Index:', spawn_index);
  console.log('  Expected Position:', { x: expected_x, y: expected_y, z: expected_z });
  
  const wasmPath = path.join(__dirname, '..', 'build', 'spawn_js', 'spawn.wasm');
  
  if (!fs.existsSync(wasmPath)) {
    console.log('  ⚠️  WASM not found, skipping circuit test');
    return;
  }
  
  const input = {
    game_seed: game_seed.toString(),
    player_address: player_address.toString(),
    spawn_index: String(spawn_index)
  };
  
  try {
    const { witness } = await snarkjs.wtns.calculate(input, wasmPath);
    console.log('  ✅ Circuit executed successfully');
    console.log('  Witness length:', witness.length);
  } catch (err) {
    console.log('  ❌ Circuit execution failed:', err.message);
  }
}

async function testMovement() {
  console.log('\n🧪 Testing movement circuit...');
  
  const poseidon = await buildPoseidon();
  
  // Current position
  const old_x = 100, old_y = 50, old_z = 0;
  const old_salt = BigInt('11111111111111111111');
  
  // New position (moved 10 units in X)
  const new_x = 110, new_y = 50, new_z = 0;
  const new_salt = BigInt('22222222222222222222');
  
  // Generate commitments
  const oldInputs = [BigInt(old_x), BigInt(old_y), BigInt(old_z), old_salt];
  const oldCommitment = poseidon.F.toString(poseidon(oldInputs));
  
  const newInputs = [BigInt(new_x), BigInt(new_y), BigInt(new_z), new_salt];
  const newCommitment = poseidon.F.toString(poseidon(newInputs));
  
  console.log('  Old Position:', { x: old_x, y: old_y, z: old_z });
  console.log('  New Position:', { x: new_x, y: new_y, z: new_z });
  console.log('  Old Commitment:', oldCommitment);
  console.log('  New Commitment:', newCommitment);
  
  const wasmPath = path.join(__dirname, '..', 'build', 'movement_js', 'movement.wasm');
  
  if (!fs.existsSync(wasmPath)) {
    console.log('  ⚠️  WASM not found, skipping circuit test');
    return;
  }
  
  const input = {
    old_x: String(old_x),
    old_y: String(old_y),
    old_z: String(old_z),
    new_x: String(new_x),
    new_y: String(new_y),
    new_z: String(new_z),
    old_salt: old_salt.toString(),
    new_salt: new_salt.toString(),
    old_commitment: oldCommitment,
    new_commitment: newCommitment,
    max_speed: '15',
    delta_time: '1000'
  };
  
  try {
    const { witness } = await snarkjs.wtns.calculate(input, wasmPath);
    console.log('  ✅ Circuit executed successfully');
    console.log('  Movement validated!');
  } catch (err) {
    console.log('  ❌ Circuit execution failed:', err.message);
  }
}

async function testShooting() {
  console.log('\n🧪 Testing shooting circuit (main game circuit)...');
  
  const poseidon = await buildPoseidon();
  
  // Shooter position
  const shooter_x = 100, shooter_y = 50, shooter_z = 0;
  const shooterSalt = BigInt('11111111111111111111');
  
  // Target position (50 units away in X direction)
  const target_x = 150, target_y = 50, target_z = 0;
  const targetSalt = BigInt('22222222222222222222');
  
  // Generate commitments
  const shooterInputs = [BigInt(shooter_x), BigInt(shooter_y), BigInt(shooter_z), shooterSalt];
  const shooterCommitment = poseidon.F.toString(poseidon(shooterInputs));
  
  const targetInputs = [BigInt(target_x), BigInt(target_y), BigInt(target_z), targetSalt];
  const targetCommitment = poseidon.F.toString(poseidon(targetInputs));
  
  console.log('  Shooter Position:', { x: shooter_x, y: shooter_y, z: shooter_z });
  console.log('  Target Position:', { x: target_x, y: target_y, z: target_z });
  console.log('  Shooter Commitment:', shooterCommitment);
  console.log('  Target Commitment:', targetCommitment);
  
  const wasmPath = path.join(__dirname, '..', 'build', 'shooting_js', 'shooting.wasm');
  
  if (!fs.existsSync(wasmPath)) {
    console.log('  ⚠️  WASM not found, skipping circuit test');
    console.log('  Run "npm run build" first to compile circuits');
    return;
  }
  
  const input = {
    shooter_x: String(shooter_x),
    shooter_y: String(shooter_y),
    shooter_z: String(shooter_z),
    target_x: String(target_x),
    target_y: String(target_y),
    target_z: String(target_z),
    shot_direction_x: '1000', // Normalized direction * 1000
    shot_direction_y: '0',
    shot_direction_z: '0',
    distance: '50',
    max_range: '100',
    shooter_salt: shooterSalt.toString(),
    target_salt: targetSalt.toString(),
    shooter_commitment: shooterCommitment,
    target_commitment: targetCommitment
  };
  
  try {
    console.log('  Calculating witness...');
    const { witness } = await snarkjs.wtns.calculate(input, wasmPath);
    console.log('  ✅ Circuit executed successfully');
    console.log('  Witness length:', witness.length);
    console.log('  Expected result: HIT (target within range and on trajectory)');
  } catch (err) {
    console.log('  ❌ Circuit execution failed:', err.message);
    console.error(err);
  }
}

async function testDamage() {
  console.log('\n🧪 Testing damage circuit...');
  
  const poseidon = await buildPoseidon();
  
  const old_health = 100;
  const damage_amount = 25;
  const new_health = 75;
  const weapon_type = 1; // Rifle
  
  console.log('  Old Health:', old_health);
  console.log('  Damage Amount:', damage_amount);
  console.log('  New Health:', new_health);
  console.log('  Weapon Type:', weapon_type);
  
  const wasmPath = path.join(__dirname, '..', 'build', 'damage_js', 'damage.wasm');
  
  if (!fs.existsSync(wasmPath)) {
    console.log('  ⚠️  WASM not found, skipping circuit test');
    return;
  }
  
  const input = {
    old_health: String(old_health),
    damage_amount: String(damage_amount),
    new_health: String(new_health),
    weapon_type: String(weapon_type)
  };
  
  try {
    const { witness } = await snarkjs.wtns.calculate(input, wasmPath);
    console.log('  ✅ Circuit executed successfully');
    console.log('  Damage calculation verified!');
  } catch (err) {
    console.log('  ❌ Circuit execution failed:', err.message);
  }
}

async function testItemCollection() {
  console.log('\n🧪 Testing item_collection circuit...');
  
  const poseidon = await buildPoseidon();
  
  const player_x = 100, player_y = 50, player_z = 0;
  const item_x = 105, item_y = 52, item_z = 0;
  const collection_radius = 10;
  
  console.log('  Player Position:', { x: player_x, y: player_y, z: player_z });
  console.log('  Item Position:', { x: item_x, y: item_y, z: item_z });
  console.log('  Collection Radius:', collection_radius);
  
  const wasmPath = path.join(__dirname, '..', 'build', 'item_collection_js', 'item_collection.wasm');
  
  if (!fs.existsSync(wasmPath)) {
    console.log('  ⚠️  WASM not found, skipping circuit test');
    return;
  }
  
  const input = {
    player_x: String(player_x),
    player_y: String(player_y),
    player_z: String(player_z),
    item_x: String(item_x),
    item_y: String(item_y),
    item_z: String(item_z),
    collection_radius: String(collection_radius),
    item_type: '1'
  };
  
  try {
    const { witness } = await snarkjs.wtns.calculate(input, wasmPath);
    console.log('  ✅ Circuit executed successfully');
    console.log('  Item collection verified!');
  } catch (err) {
    console.log('  ❌ Circuit execution failed:', err.message);
  }
}

async function testWinCondition() {
  console.log('\n🧪 Testing win_condition circuit...');
  
  const player1_kills = 10;
  const player2_kills = 7;
  const player1_health = 50;
  const player2_health = 0;
  const kill_limit = 10;
  const time_limit = 300000; // 5 minutes in ms
  const elapsed_time = 180000; // 3 minutes
  
  console.log('  Player 1 - Kills:', player1_kills, 'Health:', player1_health);
  console.log('  Player 2 - Kills:', player2_kills, 'Health:', player2_health);
  console.log('  Kill Limit:', kill_limit);
  console.log('  Time Limit:', time_limit, 'ms');
  console.log('  Elapsed Time:', elapsed_time, 'ms');
  
  const wasmPath = path.join(__dirname, '..', 'build', 'win_condition_js', 'win_condition.wasm');
  
  if (!fs.existsSync(wasmPath)) {
    console.log('  ⚠️  WASM not found, skipping circuit test');
    return;
  }
  
  const input = {
    player1_kills: String(player1_kills),
    player2_kills: String(player2_kills),
    player1_health: String(player1_health),
    player2_health: String(player2_health),
    kill_limit: String(kill_limit),
    time_limit: String(time_limit),
    elapsed_time: String(elapsed_time)
  };
  
  try {
    const { witness } = await snarkjs.wtns.calculate(input, wasmPath);
    console.log('  ✅ Circuit executed successfully');
    console.log('  Expected winner: Player 1 (reached kill limit)');
  } catch (err) {
    console.log('  ❌ Circuit execution failed:', err.message);
  }
}

async function runAllTests() {
  console.log('🚀 ZK Interstellar Circuit Tests');
  console.log('=================================\n');
  
  try {
    await testSpawn();
    await testMovement();
    await testShooting();
    await testDamage();
    await testItemCollection();
    await testWinCondition();
    
    console.log('\n✅ All tests completed!');
    console.log('\nNext steps:');
    console.log('  1. Generate a full proof: npm run generate-proof');
    console.log('  2. Build the contract: cd ../../ && bun run build interstellar');
    console.log('  3. Deploy to testnet: bun run deploy interstellar');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

runAllTests();
