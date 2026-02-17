#!/usr/bin/env node

/**
 * Generate ZK proof for poker game
 * Example script showing how to generate proofs
 */

const snarkjs = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');
const fs = require('fs');
const path = require('path');

// Example hands
const EXAMPLE_HANDS = {
  royalFlush: [51, 50, 49, 48, 47], // K♣ Q♣ J♣ 10♣ 9♣
  straightFlush: [12, 11, 10, 9, 8], // K♠ Q♠ J♠ 10♠ 9♠
  fourOfKind: [0, 13, 26, 39, 51], // A♠ A♥ A♦ A♣ K♠
  fullHouse: [0, 13, 26, 1, 14], // A♠ A♥ A♦ 2♠ 2♥
  flush: [0, 2, 4, 6, 8], // A♠ 3♠ 5♠ 7♠ 9♠
  straight: [0, 14, 28, 42, 4], // A♠ 2♥ 3♦ 4♣ 5♠
  threeOfKind: [0, 13, 26, 1, 2], // A♠ A♥ A♦ 2♠ 3♠
  twoPair: [0, 13, 1, 14, 2], // A♠ A♥ 2♠ 2♥ 3♠
  onePair: [0, 13, 1, 2, 3], // A♠ A♥ 2♠ 3♠ 4♠
  highCard: [0, 1, 2, 3, 5] // A♠ 2♠ 3♠ 4♠ 6♠
};

async function generateCommitment(cards, salt) {
  const poseidon = await buildPoseidon();
  const inputs = [...cards.map(c => BigInt(c)), BigInt(salt)];
  const hash = poseidon(inputs);
  return poseidon.F.toString(hash);
}

function randomSalt() {
  return BigInt('0x' + Array.from({ length: 64 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join(''));
}

async function generateProof(player1Cards, player2Cards) {
  console.log('🎰 Generating ZK Poker Proof\n');

  // Generate random salts
  const player1Salt = randomSalt();
  const player2Salt = randomSalt();

  console.log('Player 1 Cards:', player1Cards);
  console.log('Player 2 Cards:', player2Cards);
  console.log('');

  // Generate commitments
  console.log('📝 Generating commitments...');
  const player1Commitment = await generateCommitment(player1Cards, player1Salt);
  const player2Commitment = await generateCommitment(player2Cards, player2Salt);

  console.log('Player 1 Commitment:', player1Commitment);
  console.log('Player 2 Commitment:', player2Commitment);
  console.log('');

  // Prepare circuit inputs
  const input = {
    player1Commitment,
    player2Commitment,
    player1Cards: player1Cards.map(c => String(c)),
    player2Cards: player2Cards.map(c => String(c)),
    player1Salt: player1Salt.toString(),
    player2Salt: player2Salt.toString()
  };

  // Generate proof
  console.log('🔐 Generating zero-knowledge proof...');
  console.log('(This may take a few seconds)');

  const wasmPath = path.join(__dirname, '..', 'build', 'poker_game_js', 'poker_game.wasm');
  const zkeyPath = path.join(__dirname, '..', 'poker_game_final.zkey');

  if (!fs.existsSync(wasmPath)) {
    console.error('❌ WASM file not found. Please run "npm run compile" first.');
    process.exit(1);
  }

  if (!fs.existsSync(zkeyPath)) {
    console.error('❌ Proving key not found. Please run "npm run setup" first.');
    process.exit(1);
  }

  const startTime = Date.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath
  );
  const proofTime = Date.now() - startTime;

  console.log(`✅ Proof generated in ${proofTime}ms\n`);

  // Verify proof
  console.log('🔍 Verifying proof...');
  const vkeyPath = path.join(__dirname, '..', 'verification_key.json');
  const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));

  const verifyStartTime = Date.now();
  const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  const verifyTime = Date.now() - verifyStartTime;

  if (isValid) {
    console.log(`✅ Proof verified in ${verifyTime}ms\n`);
  } else {
    console.log('❌ Invalid proof!\n');
    process.exit(1);
  }

  // Parse public signals
  console.log('📊 Game Results:');
  console.log('Player 1 Ranking:', publicSignals[0]);
  console.log('Player 2 Ranking:', publicSignals[1]);
  const winner = parseInt(publicSignals[2]);
  console.log('Winner:', winner === 1 ? 'Player 1' : winner === 2 ? 'Player 2' : 'Tie');
  console.log('');

  // Save proof to file
  const proofData = {
    proof,
    publicSignals,
    input: {
      player1Cards,
      player2Cards,
      player1Commitment,
      player2Commitment
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      proofTime: `${proofTime}ms`,
      verifyTime: `${verifyTime}ms`
    }
  };

  const outputPath = path.join(__dirname, '..', 'proof.json');
  fs.writeFileSync(outputPath, JSON.stringify(proofData, null, 2));
  console.log(`💾 Proof saved to: ${outputPath}`);

  return proofData;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  let player1Cards, player2Cards;

  if (args.length === 0) {
    // Use example hands
    console.log('Using example hands (Four of a Kind vs Full House)\n');
    player1Cards = EXAMPLE_HANDS.fourOfKind;
    player2Cards = EXAMPLE_HANDS.fullHouse;
  } else if (args.length === 2) {
    // Parse custom hands
    player1Cards = args[0].split(',').map(Number);
    player2Cards = args[1].split(',').map(Number);

    if (player1Cards.length !== 5 || player2Cards.length !== 5) {
      console.error('❌ Each hand must have exactly 5 cards');
      process.exit(1);
    }
  } else {
    console.log('Usage: node generate_proof.js [player1Cards] [player2Cards]');
    console.log('Example: node generate_proof.js "0,13,26,39,51" "0,13,26,1,14"');
    console.log('\nRunning with default example hands...\n');
    player1Cards = EXAMPLE_HANDS.fourOfKind;
    player2Cards = EXAMPLE_HANDS.fullHouse;
  }

  try {
    await generateProof(player1Cards, player2Cards);
    console.log('\n🎉 Success!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
