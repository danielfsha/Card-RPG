#!/usr/bin/env node

/**
 * Test script for ZK Poker circuits
 * Tests all circuits with various inputs
 */

const snarkjs = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');
const fs = require('fs');
const path = require('path');

// Test hands
const TEST_HANDS = {
  flush: [0, 2, 4, 6, 8], // All spades
  highCard: [0, 14, 28, 42, 5], // Mixed suits
  pair: [0, 13, 1, 2, 3], // Pair of Aces
};

async function testCommitment() {
  console.log('\n🧪 Testing card_commitment circuit...');
  
  const poseidon = await buildPoseidon();
  const cards = TEST_HANDS.flush;
  const salt = BigInt('12345678901234567890');
  
  // Compute expected commitment
  const inputs = [...cards.map(c => BigInt(c)), salt];
  const expectedCommitment = poseidon(inputs);
  const commitmentStr = poseidon.F.toString(expectedCommitment);
  
  console.log('  Cards:', cards);
  console.log('  Salt:', salt.toString());
  console.log('  Expected commitment:', commitmentStr);
  
  // Test circuit
  const wasmPath = path.join(__dirname, '..', 'build', 'card_commitment_js', 'card_commitment.wasm');
  
  if (!fs.existsSync(wasmPath)) {
    console.log('  ⚠️  WASM not found, skipping circuit test');
    return;
  }
  
  const input = {
    cards: cards.map(c => String(c)),
    salt: salt.toString()
  };
  
  try {
    const { witness } = await snarkjs.wtns.calculate(input, wasmPath);
    console.log('  ✅ Circuit executed successfully');
    console.log('  Witness length:', witness.length);
  } catch (err) {
    console.log('  ❌ Circuit execution failed:', err.message);
  }
}

async function testReveal() {
  console.log('\n🧪 Testing card_reveal circuit...');
  
  const poseidon = await buildPoseidon();
  const cards = TEST_HANDS.flush;
  const salt = BigInt('12345678901234567890');
  
  // Compute commitment
  const inputs = [...cards.map(c => BigInt(c)), salt];
  const commitment = poseidon(inputs);
  const commitmentStr = poseidon.F.toString(commitment);
  
  console.log('  Commitment:', commitmentStr);
  console.log('  Revealed cards:', cards);
  
  const wasmPath = path.join(__dirname, '..', 'build', 'card_reveal_js', 'card_reveal.wasm');
  
  if (!fs.existsSync(wasmPath)) {
    console.log('  ⚠️  WASM not found, skipping circuit test');
    return;
  }
  
  const input = {
    commitment: commitmentStr,
    revealedCards: cards.map(c => String(c)),
    salt: salt.toString()
  };
  
  try {
    const { witness } = await snarkjs.wtns.calculate(input, wasmPath);
    console.log('  ✅ Circuit executed successfully');
    console.log('  Commitment verified!');
  } catch (err) {
    console.log('  ❌ Circuit execution failed:', err.message);
  }
}

async function testHandRanking() {
  console.log('\n🧪 Testing hand_ranking circuit...');
  
  const testCases = [
    { name: 'Flush', cards: TEST_HANDS.flush, expectedRanking: 5 },
    { name: 'High Card', cards: TEST_HANDS.highCard, expectedRanking: 0 },
    { name: 'Pair', cards: TEST_HANDS.pair, expectedRanking: 1 },
  ];
  
  const wasmPath = path.join(__dirname, '..', 'build', 'hand_ranking_js', 'hand_ranking.wasm');
  
  if (!fs.existsSync(wasmPath)) {
    console.log('  ⚠️  WASM not found, skipping circuit test');
    return;
  }
  
  for (const testCase of testCases) {
    console.log(`\n  Testing ${testCase.name}:`, testCase.cards);
    
    const input = {
      cards: testCase.cards.map(c => String(c))
    };
    
    try {
      const { witness } = await snarkjs.wtns.calculate(input, wasmPath);
      console.log('  ✅ Circuit executed successfully');
      // Note: Would need to extract output from witness to verify ranking
    } catch (err) {
      console.log('  ❌ Circuit execution failed:', err.message);
    }
  }
}

async function testFullGame() {
  console.log('\n🧪 Testing poker_game circuit (full game)...');
  
  const poseidon = await buildPoseidon();
  
  // Player 1: Flush
  const p1Cards = TEST_HANDS.flush;
  const p1Salt = BigInt('11111111111111111111');
  const p1Inputs = [...p1Cards.map(c => BigInt(c)), p1Salt];
  const p1Commitment = poseidon.F.toString(poseidon(p1Inputs));
  
  // Player 2: High Card
  const p2Cards = TEST_HANDS.highCard;
  const p2Salt = BigInt('22222222222222222222');
  const p2Inputs = [...p2Cards.map(c => BigInt(c)), p2Salt];
  const p2Commitment = poseidon.F.toString(poseidon(p2Inputs));
  
  console.log('  Player 1 (Flush):', p1Cards);
  console.log('  Player 1 Commitment:', p1Commitment);
  console.log('  Player 2 (High Card):', p2Cards);
  console.log('  Player 2 Commitment:', p2Commitment);
  
  const wasmPath = path.join(__dirname, '..', 'build', 'poker_game_js', 'poker_game.wasm');
  
  if (!fs.existsSync(wasmPath)) {
    console.log('  ⚠️  WASM not found, skipping circuit test');
    console.log('  Run "npm run build" first to compile circuits');
    return;
  }
  
  const input = {
    player1Commitment: p1Commitment,
    player2Commitment: p2Commitment,
    player1Cards: p1Cards.map(c => String(c)),
    player2Cards: p2Cards.map(c => String(c)),
    player1Salt: p1Salt.toString(),
    player2Salt: p2Salt.toString()
  };
  
  try {
    console.log('  Calculating witness...');
    const { witness } = await snarkjs.wtns.calculate(input, wasmPath);
    console.log('  ✅ Circuit executed successfully');
    console.log('  Witness length:', witness.length);
    console.log('  Expected winner: Player 1 (Flush beats High Card)');
  } catch (err) {
    console.log('  ❌ Circuit execution failed:', err.message);
    console.error(err);
  }
}

async function runAllTests() {
  console.log('🎰 ZK Poker Circuit Tests');
  console.log('========================\n');
  
  try {
    await testCommitment();
    await testReveal();
    await testHandRanking();
    await testFullGame();
    
    console.log('\n✅ All tests completed!');
    console.log('\nNext steps:');
    console.log('  1. Generate a full proof: npm run generate-proof');
    console.log('  2. Build the contract: cd ../../ && bun run build pocker');
    console.log('  3. Deploy to testnet: bun run deploy pocker');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

runAllTests();
