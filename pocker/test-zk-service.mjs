#!/usr/bin/env node

/**
 * Test script for ZK Poker Service
 * Tests commitment generation and proof generation
 */

import { buildPoseidon } from 'circomlibjs';
import * as snarkjs from 'snarkjs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing ZK Poker Service\n');

// Test 1: Poseidon Hash Initialization
console.log('Test 1: Initializing Poseidon hash...');
let poseidon;
try {
  poseidon = await buildPoseidon();
  console.log('✅ Poseidon initialized successfully\n');
} catch (err) {
  console.error('❌ Failed to initialize Poseidon:', err.message);
  process.exit(1);
}

// Test 2: Commitment Generation
console.log('Test 2: Generating commitment...');
try {
  const cards = [0, 1, 2, 3, 4]; // 2♠, 3♠, 4♠, 5♠, 6♠
  const salt = BigInt('12345');
  
  const inputs = [...cards.map(c => BigInt(c)), salt];
  const hash = poseidon(inputs);
  const commitment = poseidon.F.toString(hash);
  
  console.log('   Cards:', cards);
  console.log('   Salt:', salt.toString());
  console.log('   Commitment:', commitment.substring(0, 40) + '...');
  console.log('✅ Commitment generated successfully\n');
} catch (err) {
  console.error('❌ Failed to generate commitment:', err.message);
  process.exit(1);
}

// Test 3: Check Circuit Artifacts
console.log('Test 3: Checking circuit artifacts...');
const wasmPath = join(__dirname, 'public/circuits/poker_game.wasm');
const zkeyPath = join(__dirname, 'public/circuits/poker_game_final.zkey');
const vkeyPath = join(__dirname, 'public/circuits/verification_key.json');

try {
  const wasmExists = readFileSync(wasmPath);
  console.log('   ✓ poker_game.wasm found (' + (wasmExists.length / 1024).toFixed(0) + ' KB)');
  
  const zkeyExists = readFileSync(zkeyPath);
  console.log('   ✓ poker_game_final.zkey found (' + (zkeyExists.length / 1024 / 1024).toFixed(1) + ' MB)');
  
  const vkeyExists = readFileSync(vkeyPath, 'utf-8');
  const vkey = JSON.parse(vkeyExists);
  console.log('   ✓ verification_key.json found (protocol:', vkey.protocol + ')');
  
  console.log('✅ All circuit artifacts present\n');
} catch (err) {
  console.error('❌ Circuit artifacts missing:', err.message);
  console.error('   Run: cd circuits/pocker && bash setup-trusted.sh');
  process.exit(1);
}

// Test 4: Proof Generation (this will take a few seconds)
console.log('Test 4: Generating ZK proof (this may take 5-10 seconds)...');
try {
  // Player 1: Straight Flush (2♠, 3♠, 4♠, 5♠, 6♠)
  const player1Cards = [0, 1, 2, 3, 4];
  const player1Salt = BigInt('11111');
  const player1Inputs = [...player1Cards.map(c => BigInt(c)), player1Salt];
  const player1Hash = poseidon(player1Inputs);
  const player1Commitment = poseidon.F.toString(player1Hash);
  
  // Player 2: High Card (2♥, 4♥, 6♥, 8♥, 10♥)
  const player2Cards = [13, 15, 17, 19, 21];
  const player2Salt = BigInt('22222');
  const player2Inputs = [...player2Cards.map(c => BigInt(c)), player2Salt];
  const player2Hash = poseidon(player2Inputs);
  const player2Commitment = poseidon.F.toString(player2Hash);
  
  console.log('   Player 1: Straight Flush');
  console.log('   Player 2: High Card');
  console.log('   Generating proof...');
  
  const startTime = Date.now();
  
  const input = {
    player1Commitment,
    player2Commitment,
    player1Cards: player1Cards.map(c => String(c)),
    player2Cards: player2Cards.map(c => String(c)),
    player1Salt: player1Salt.toString(),
    player2Salt: player2Salt.toString()
  };
  
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath
  );
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log('   ✓ Proof generated in', duration, 'seconds');
  console.log('   Public signals:', publicSignals.length);
  console.log('   - Player 1 commitment:', publicSignals[0].substring(0, 20) + '...');
  console.log('   - Player 2 commitment:', publicSignals[1].substring(0, 20) + '...');
  console.log('   - Player 1 ranking:', publicSignals[2], '(Straight Flush = 8)');
  console.log('   - Player 2 ranking:', publicSignals[3], '(High Card = 0)');
  console.log('   - Winner:', publicSignals[4], '(1 = Player 1, 2 = Player 2)');
  
  console.log('✅ Proof generated successfully\n');
  
  // Test 5: Verify Proof
  console.log('Test 5: Verifying proof...');
  const vKey = JSON.parse(readFileSync(vkeyPath, 'utf-8'));
  const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
  
  if (isValid) {
    console.log('✅ Proof verified successfully\n');
  } else {
    console.error('❌ Proof verification failed\n');
    process.exit(1);
  }
  
} catch (err) {
  console.error('❌ Proof generation failed:', err.message);
  console.error(err.stack);
  process.exit(1);
}

console.log('🎉 All tests passed!\n');
console.log('Summary:');
console.log('  ✅ Poseidon hash working');
console.log('  ✅ Commitment generation working');
console.log('  ✅ Circuit artifacts present');
console.log('  ✅ Proof generation working');
console.log('  ✅ Proof verification working');
console.log('\nThe ZK Poker service is ready to use! 🃏\n');
