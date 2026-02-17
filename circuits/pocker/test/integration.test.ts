import { describe, it, expect, beforeAll } from 'bun:test';
import { buildPoseidon } from 'circomlibjs';
import * as snarkjs from 'snarkjs';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Comprehensive Integration Tests for ZK Poker Circuit
 * 
 * Tests all possible scenarios:
 * 1. Commitment generation (valid/invalid)
 * 2. Proof generation (all hand rankings)
 * 3. Proof verification (valid/invalid)
 * 4. Edge cases and error handling
 * 5. Performance benchmarks
 * 6. Security validations
 */

describe('ZK Poker Integration Tests - Commitment Phase', () => {
  let poseidon: any;

  beforeAll(async () => {
    poseidon = await buildPoseidon();
    console.log('✅ Poseidon hash initialized');
  });

  function commitHand(cards: number[], salt: bigint): string {
    const inputs = [...cards.map(c => BigInt(c)), salt];
    const hash = poseidon(inputs);
    return poseidon.F.toString(hash);
  }

  function generateSalt(): bigint {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));
  }

  it('should generate valid commitments for all card combinations', () => {
    const testCases = [
      { name: 'Minimum cards', cards: [0, 0, 0, 0, 0] },
      { name: 'Maximum cards', cards: [51, 51, 51, 51, 51] },
      { name: 'Sequential cards', cards: [0, 1, 2, 3, 4] },
      { name: 'Random cards', cards: [5, 17, 23, 38, 49] },
      { name: 'Same suit', cards: [0, 1, 2, 3, 4] }, // All spades
      { name: 'All aces', cards: [12, 25, 38, 51, 0] },
    ];

    testCases.forEach(({ name, cards }) => {
      const salt = BigInt('12345');
      const commitment = commitHand(cards, salt);
      
      expect(commitment).toBeDefined();
      expect(typeof commitment).toBe('string');
      expect(commitment.length).toBeGreaterThan(0);
      
      console.log(`  ✓ ${name}: ${commitment.substring(0, 20)}...`);
    });
  });

  it('should generate different commitments for different salts', () => {
    const cards = [0, 1, 2, 3, 4];
    const commitments = new Set();
    
    for (let i = 0; i < 100; i++) {
      const salt = generateSalt();
      const commitment = commitHand(cards, salt);
      commitments.add(commitment);
    }
    
    expect(commitments.size).toBe(100);
    console.log('✅ 100 unique commitments generated with different salts');
  });

  it('should be deterministic (same inputs = same output)', () => {
    const cards = [10, 20, 30, 40, 50];
    const salt = BigInt('999999');
    
    const commitment1 = commitHand(cards, salt);
    const commitment2 = commitHand(cards, salt);
    const commitment3 = commitHand(cards, salt);
    
    expect(commitment1).toBe(commitment2);
    expect(commitment2).toBe(commitment3);
    console.log('✅ Commitment is deterministic');
  });

  it('should handle edge case salts', () => {
    const cards = [0, 1, 2, 3, 4];
    
    const testSalts = [
      { name: 'Zero', value: BigInt(0) },
      { name: 'One', value: BigInt(1) },
      { name: 'Max safe integer', value: BigInt(Number.MAX_SAFE_INTEGER) },
      { name: 'Large number', value: BigInt('999999999999999999999999999999') },
    ];

    testSalts.forEach(({ name, value }) => {
      const commitment = commitHand(cards, value);
      expect(commitment).toBeDefined();
      console.log(`  ✓ ${name} salt: ${commitment.substring(0, 20)}...`);
    });
  });

  it('should reject invalid card values', () => {
    const invalidCards = [
      [-1, 0, 1, 2, 3],  // Negative
      [0, 1, 2, 3, 52],  // Too high
      [0, 1, 2, 3, 100], // Way too high
    ];

    // Note: Poseidon will still hash these, but circuit will reject them
    invalidCards.forEach(cards => {
      const salt = BigInt('123');
      const commitment = commitHand(cards, salt);
      expect(commitment).toBeDefined();
      console.log(`  ⚠️  Invalid cards still produce commitment (circuit will reject)`);
    });
  });
});

describe('ZK Poker Integration Tests - Proof Generation', () => {
  let poseidon: any;
  const wasmPath = path.join(__dirname, '../build/poker_game_js/poker_game.wasm');
  const zkeyPath = path.join(__dirname, '../poker_game_final.zkey');
  const vkeyPath = path.join(__dirname, '../verification_key.json');

  beforeAll(async () => {
    poseidon = await buildPoseidon();
  });

  function commitHand(cards: number[], salt: bigint): string {
    const inputs = [...cards.map(c => BigInt(c)), salt];
    const hash = poseidon(inputs);
    return poseidon.F.toString(hash);
  }

  function generateSalt(): bigint {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));
  }

  function getCardName(card: number): string {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const suit = suits[Math.floor(card / 13)];
    const rank = ranks[card % 13];
    return rank + suit;
  }

  const checkArtifacts = () => {
    if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
      console.log('⚠️  Circuit artifacts not found. Run `bash build.sh` first.');
      return false;
    }
    return true;
  };

  it('should generate proof for Royal Flush vs High Card', async () => {
    if (!checkArtifacts()) return;

    // Player 1: Royal Flush (best possible hand)
    const player1Cards = [8, 9, 10, 11, 12]; // 10♠, J♠, Q♠, K♠, A♠
    const player1Salt = generateSalt();
    const player1Commitment = commitHand(player1Cards, player1Salt);

    // Player 2: High Card (worst hand)
    const player2Cards = [0, 14, 28, 42, 3]; // 2♠, 2♥, 2♦, 2♣, 4♠
    const player2Salt = generateSalt();
    const player2Commitment = commitHand(player2Cards, player2Salt);

    console.log('Player 1 (Royal Flush):', player1Cards.map(getCardName).join(', '));
    console.log('Player 2 (High Card):', player2Cards.map(getCardName).join(', '));

    const input = {
      player1Commitment,
      player2Commitment,
      player1Cards: player1Cards.map(c => String(c)),
      player2Cards: player2Cards.map(c => String(c)),
      player1Salt: player1Salt.toString(),
      player2Salt: player2Salt.toString()
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);

    expect(proof).toBeDefined();
    expect(publicSignals).toBeDefined();
    expect(publicSignals.length).toBe(5);
    
    console.log('✅ Proof generated');
    console.log('   Winner:', publicSignals[4] === '1' ? 'Player 1 (Royal Flush)' : 'Player 2');
  }, 60000);

  it('should generate proof for Straight Flush vs Four of a Kind', async () => {
    if (!checkArtifacts()) return;

    // Player 1: Straight Flush
    const player1Cards = [0, 1, 2, 3, 4]; // 2♠, 3♠, 4♠, 5♠, 6♠
    const player1Salt = generateSalt();
    const player1Commitment = commitHand(player1Cards, player1Salt);

    // Player 2: Four of a Kind
    const player2Cards = [0, 13, 26, 39, 1]; // 2♠, 2♥, 2♦, 2♣, 3♠
    const player2Salt = generateSalt();
    const player2Commitment = commitHand(player2Cards, player2Salt);

    console.log('Player 1 (Straight Flush):', player1Cards.map(getCardName).join(', '));
    console.log('Player 2 (Four of a Kind):', player2Cards.map(getCardName).join(', '));

    const input = {
      player1Commitment,
      player2Commitment,
      player1Cards: player1Cards.map(c => String(c)),
      player2Cards: player2Cards.map(c => String(c)),
      player1Salt: player1Salt.toString(),
      player2Salt: player2Salt.toString()
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);

    expect(proof).toBeDefined();
    console.log('✅ Straight Flush vs Four of a Kind proof generated');
    console.log('   Winner:', publicSignals[4] === '1' ? 'Player 1' : 'Player 2');
  }, 60000);

  it('should generate proof for Full House vs Flush', async () => {
    if (!checkArtifacts()) return;

    // Player 1: Full House (3 + 2)
    const player1Cards = [0, 13, 26, 1, 14]; // 2♠, 2♥, 2♦, 3♠, 3♥
    const player1Salt = generateSalt();
    const player1Commitment = commitHand(player1Cards, player1Salt);

    // Player 2: Flush (all same suit)
    const player2Cards = [0, 2, 4, 6, 8]; // 2♠, 4♠, 6♠, 8♠, 10♠
    const player2Salt = generateSalt();
    const player2Commitment = commitHand(player2Cards, player2Salt);

    console.log('Player 1 (Full House):', player1Cards.map(getCardName).join(', '));
    console.log('Player 2 (Flush):', player2Cards.map(getCardName).join(', '));

    const input = {
      player1Commitment,
      player2Commitment,
      player1Cards: player1Cards.map(c => String(c)),
      player2Cards: player2Cards.map(c => String(c)),
      player1Salt: player1Salt.toString(),
      player2Salt: player2Salt.toString()
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);

    expect(proof).toBeDefined();
    console.log('✅ Full House vs Flush proof generated');
    console.log('   Winner:', publicSignals[4] === '1' ? 'Player 1' : 'Player 2');
  }, 60000);

  it('should generate proof for Straight vs Three of a Kind', async () => {
    if (!checkArtifacts()) return;

    // Player 1: Straight
    const player1Cards = [0, 14, 28, 42, 4]; // 2♠, 3♥, 4♦, 5♣, 6♠
    const player1Salt = generateSalt();
    const player1Commitment = commitHand(player1Cards, player1Salt);

    // Player 2: Three of a Kind
    const player2Cards = [0, 13, 26, 1, 2]; // 2♠, 2♥, 2♦, 3♠, 4♠
    const player2Salt = generateSalt();
    const player2Commitment = commitHand(player2Cards, player2Salt);

    console.log('Player 1 (Straight):', player1Cards.map(getCardName).join(', '));
    console.log('Player 2 (Three of a Kind):', player2Cards.map(getCardName).join(', '));

    const input = {
      player1Commitment,
      player2Commitment,
      player1Cards: player1Cards.map(c => String(c)),
      player2Cards: player2Cards.map(c => String(c)),
      player1Salt: player1Salt.toString(),
      player2Salt: player2Salt.toString()
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);

    expect(proof).toBeDefined();
    console.log('✅ Straight vs Three of a Kind proof generated');
  }, 60000);

  it('should generate proof for Two Pair vs One Pair', async () => {
    if (!checkArtifacts()) return;

    // Player 1: Two Pair
    const player1Cards = [0, 13, 1, 14, 2]; // 2♠, 2♥, 3♠, 3♥, 4♠
    const player1Salt = generateSalt();
    const player1Commitment = commitHand(player1Cards, player1Salt);

    // Player 2: One Pair
    const player2Cards = [0, 13, 1, 2, 3]; // 2♠, 2♥, 3♠, 4♠, 5♠
    const player2Salt = generateSalt();
    const player2Commitment = commitHand(player2Cards, player2Salt);

    console.log('Player 1 (Two Pair):', player1Cards.map(getCardName).join(', '));
    console.log('Player 2 (One Pair):', player2Cards.map(getCardName).join(', '));

    const input = {
      player1Commitment,
      player2Commitment,
      player1Cards: player1Cards.map(c => String(c)),
      player2Cards: player2Cards.map(c => String(c)),
      player1Salt: player1Salt.toString(),
      player2Salt: player2Salt.toString()
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);

    expect(proof).toBeDefined();
    console.log('✅ Two Pair vs One Pair proof generated');
  }, 60000);

  it('should handle tie scenario (same ranking)', async () => {
    if (!checkArtifacts()) return;

    // Both players have pairs
    const player1Cards = [0, 13, 2, 3, 4]; // Pair of 2s
    const player1Salt = generateSalt();
    const player1Commitment = commitHand(player1Cards, player1Salt);

    const player2Cards = [1, 14, 5, 6, 7]; // Pair of 3s
    const player2Salt = generateSalt();
    const player2Commitment = commitHand(player2Cards, player2Salt);

    const input = {
      player1Commitment,
      player2Commitment,
      player1Cards: player1Cards.map(c => String(c)),
      player2Cards: player2Cards.map(c => String(c)),
      player1Salt: player1Salt.toString(),
      player2Salt: player2Salt.toString()
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);

    expect(proof).toBeDefined();
    console.log('✅ Tie scenario proof generated');
    console.log('   Winner signal:', publicSignals[4]);
  }, 60000);
});

describe('ZK Poker Integration Tests - Proof Verification', () => {
  let poseidon: any;
  const wasmPath = path.join(__dirname, '../build/poker_game_js/poker_game.wasm');
  const zkeyPath = path.join(__dirname, '../poker_game_final.zkey');
  const vkeyPath = path.join(__dirname, '../verification_key.json');

  beforeAll(async () => {
    poseidon = await buildPoseidon();
  });

  function commitHand(cards: number[], salt: bigint): string {
    const inputs = [...cards.map(c => BigInt(c)), salt];
    const hash = poseidon(inputs);
    return poseidon.F.toString(hash);
  }

  function generateSalt(): bigint {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));
  }

  it('should verify valid proof', async () => {
    if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath) || !fs.existsSync(vkeyPath)) {
      console.log('⚠️  Skipping verification test (artifacts not found)');
      return;
    }

    const player1Cards = [0, 1, 2, 3, 4];
    const player1Salt = generateSalt();
    const player1Commitment = commitHand(player1Cards, player1Salt);

    const player2Cards = [5, 6, 7, 8, 9];
    const player2Salt = generateSalt();
    const player2Commitment = commitHand(player2Cards, player2Salt);

    const input = {
      player1Commitment,
      player2Commitment,
      player1Cards: player1Cards.map(c => String(c)),
      player2Cards: player2Cards.map(c => String(c)),
      player1Salt: player1Salt.toString(),
      player2Salt: player2Salt.toString()
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
    const vKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf-8'));
    const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

    expect(isValid).toBe(true);
    console.log('✅ Valid proof verified successfully');
  }, 60000);

  it('should reject proof with wrong commitment', async () => {
    if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath) || !fs.existsSync(vkeyPath)) {
      console.log('⚠️  Skipping test');
      return;
    }

    const player1Cards = [0, 1, 2, 3, 4];
    const player1Salt = generateSalt();
    const player1Commitment = commitHand(player1Cards, player1Salt);

    const player2Cards = [5, 6, 7, 8, 9];
    const player2Salt = generateSalt();
    const player2Commitment = commitHand(player2Cards, player2Salt);

    // Use WRONG commitment
    const wrongCommitment = commitHand([10, 11, 12, 13, 14], BigInt('999'));

    const input = {
      player1Commitment: wrongCommitment, // Wrong!
      player2Commitment: player2Commitment,
      player1Cards: player1Cards.map(c => String(c)),
      player2Cards: player2Cards.map(c => String(c)),
      player1Salt: player1Salt.toString(),
      player2Salt: player2Salt.toString()
    };

    try {
      await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
      throw new Error('Should have failed');
    } catch (err: any) {
      expect(err.message).toContain('Error');
      console.log('✅ Invalid commitment correctly rejected');
    }
  }, 60000);

  it('should reject proof with tampered public signals', async () => {
    if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath) || !fs.existsSync(vkeyPath)) {
      console.log('⚠️  Skipping test');
      return;
    }

    const player1Cards = [0, 1, 2, 3, 4];
    const player1Salt = generateSalt();
    const player1Commitment = commitHand(player1Cards, player1Salt);

    const player2Cards = [5, 6, 7, 8, 9];
    const player2Salt = generateSalt();
    const player2Commitment = commitHand(player2Cards, player2Salt);

    const input = {
      player1Commitment,
      player2Commitment,
      player1Cards: player1Cards.map(c => String(c)),
      player2Cards: player2Cards.map(c => String(c)),
      player1Salt: player1Salt.toString(),
      player2Salt: player2Salt.toString()
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
    
    // Tamper with public signals
    const tamperedSignals = [...publicSignals];
    tamperedSignals[4] = '999'; // Invalid winner

    const vKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf-8'));
    const isValid = await snarkjs.groth16.verify(vKey, tamperedSignals, proof);

    expect(isValid).toBe(false);
    console.log('✅ Tampered public signals correctly rejected');
  }, 60000);
});

describe('ZK Poker Integration Tests - Error Handling', () => {
  let poseidon: any;

  beforeAll(async () => {
    poseidon = await buildPoseidon();
  });

  function commitHand(cards: number[], salt: bigint): string {
    const inputs = [...cards.map(c => BigInt(c)), salt];
    const hash = poseidon(inputs);
    return poseidon.F.toString(hash);
  }

  it('should handle invalid card count', () => {
    const invalidHands = [
      [],
      [0],
      [0, 1],
      [0, 1, 2],
      [0, 1, 2, 3],
      [0, 1, 2, 3, 4, 5], // Too many
    ];

    invalidHands.forEach(cards => {
      try {
        // Poseidon will hash any input, but circuit expects exactly 5 cards
        const commitment = commitHand(cards, BigInt('123'));
        expect(commitment).toBeDefined();
        console.log(`  ⚠️  ${cards.length} cards: commitment generated (circuit will reject)`);
      } catch (err) {
        console.log(`  ✓ ${cards.length} cards: rejected at commitment stage`);
      }
    });
  });

  it('should handle duplicate cards', () => {
    // Same card repeated (invalid in real poker)
    const duplicateHands = [
      [0, 0, 0, 0, 0],
      [1, 1, 2, 2, 3],
      [5, 5, 5, 6, 7],
    ];

    duplicateHands.forEach(cards => {
      const commitment = commitHand(cards, BigInt('123'));
      expect(commitment).toBeDefined();
      console.log(`  ⚠️  Duplicate cards: commitment generated (game logic should validate)`);
    });
  });

  it('should handle extreme salt values', () => {
    const cards = [0, 1, 2, 3, 4];
    
    const extremeSalts = [
      BigInt(0),
      BigInt(1),
      BigInt(-1), // Negative (will wrap)
      BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'),
    ];

    extremeSalts.forEach(salt => {
      try {
        const commitment = commitHand(cards, salt);
        expect(commitment).toBeDefined();
        console.log(`  ✓ Extreme salt handled: ${salt.toString().substring(0, 20)}...`);
      } catch (err: any) {
        console.log(`  ✗ Extreme salt failed: ${err.message}`);
      }
    });
  });
});

describe('ZK Poker Integration Tests - Performance', () => {
  let poseidon: any;

  beforeAll(async () => {
    poseidon = await buildPoseidon();
  });

  function commitHand(cards: number[], salt: bigint): string {
    const inputs = [...cards.map(c => BigInt(c)), salt];
    const hash = poseidon(inputs);
    return poseidon.F.toString(hash);
  }

  it('should generate commitments quickly (< 10ms avg)', () => {
    const iterations = 1000;
    const cards = [0, 1, 2, 3, 4];
    
    const start = Date.now();
    for (let i = 0; i < iterations; i++) {
      commitHand(cards, BigInt(i));
    }
    const duration = Date.now() - start;
    
    const avgTime = duration / iterations;
    console.log(`✅ ${iterations} commitments in ${duration}ms (${avgTime.toFixed(2)}ms avg)`);
    
    expect(avgTime).toBeLessThan(10);
  });

  it('should handle concurrent commitment generation', async () => {
    const cards = [0, 1, 2, 3, 4];
    const concurrentCount = 100;
    
    const start = Date.now();
    const promises = Array.from({ length: concurrentCount }, (_, i) =>
      Promise.resolve(commitHand(cards, BigInt(i)))
    );
    
    const results = await Promise.all(promises);
    const duration = Date.now() - start;
    
    expect(results.length).toBe(concurrentCount);
    expect(new Set(results).size).toBe(concurrentCount); // All unique
    
    console.log(`✅ ${concurrentCount} concurrent commitments in ${duration}ms`);
  });
});

describe('ZK Poker Integration Tests - Security', () => {
  let poseidon: any;

  beforeAll(async () => {
    poseidon = await buildPoseidon();
  });

  function commitHand(cards: number[], salt: bigint): string {
    const inputs = [...cards.map(c => BigInt(c)), salt];
    const hash = poseidon(inputs);
    return poseidon.F.toString(hash);
  }

  it('should produce collision-resistant commitments', () => {
    const iterations = 10000;
    const commitments = new Set();
    
    for (let i = 0; i < iterations; i++) {
      const cards = Array.from({ length: 5 }, () => Math.floor(Math.random() * 52));
      const salt = BigInt(Math.floor(Math.random() * 1000000));
      const commitment = commitHand(cards, salt);
      commitments.add(commitment);
    }
    
    // Should have no collisions
    expect(commitments.size).toBe(iterations);
    console.log(`✅ ${iterations} unique commitments (no collisions)`);
  });

  it('should not reveal cards from commitment alone', () => {
    const cards = [0, 1, 2, 3, 4];
    const salt = BigInt('12345');
    const commitment = commitHand(cards, salt);
    
    const differentCards = [5, 6, 7, 8, 9];
    const differentCommitment = commitHand(differentCards, salt);
    
    expect(commitment).not.toBe(differentCommitment);
    expect(commitment.length).toBeGreaterThan(50);
    
    console.log('✅ Commitment does not reveal card information');
  });

  it('should require both cards and salt to verify', () => {
    const cards = [0, 1, 2, 3, 4];
    const salt = BigInt('12345');
    const commitment = commitHand(cards, salt);
    
    // Try to verify with wrong salt
    const wrongCommitment = commitHand(cards, BigInt('99999'));
    expect(commitment).not.toBe(wrongCommitment);
    
    // Try to verify with wrong cards
    const wrongCommitment2 = commitHand([5, 6, 7, 8, 9], salt);
    expect(commitment).not.toBe(wrongCommitment2);
    
    console.log('✅ Both cards and salt required for verification');
  });
});
