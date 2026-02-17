import { buildPoseidon } from 'circomlibjs';
import * as snarkjs from 'snarkjs';

/**
 * ZK Poker Service
 * Handles commitment generation, proof generation, and verification for ZK poker
 */
export class ZKPokerService {
  private poseidon: any;
  private wasmPath: string;
  private zkeyPath: string;
  private initialized: boolean = false;

  constructor() {
    this.wasmPath = '/circuits/poker_game.wasm';
    this.zkeyPath = '/circuits/poker_game_final.zkey';
  }

  /**
   * Initialize the service (load Poseidon hash)
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('[ZKPokerService] Initializing Poseidon hash...');
      this.poseidon = await buildPoseidon();
      this.initialized = true;
      console.log('[ZKPokerService] ✅ Initialized successfully');
    } catch (err) {
      console.error('[ZKPokerService] Failed to initialize:', err);
      throw new Error('Failed to initialize ZK service');
    }
  }

  /**
   * Generate commitment for a hand using Poseidon hash
   * 
   * @param cards - Array of 5 card values (0-51)
   * @param salt - Random salt for commitment
   * @returns Commitment hash as string
   */
  async commitHand(cards: number[], salt: bigint): Promise<string> {
    if (!this.initialized) await this.initialize();
    
    if (cards.length !== 5) {
      throw new Error('Hand must contain exactly 5 cards');
    }

    // Validate card values
    for (const card of cards) {
      if (card < 0 || card > 51) {
        throw new Error(`Invalid card value: ${card}. Must be 0-51.`);
      }
    }
    
    // Create input array: [card1, card2, card3, card4, card5, salt]
    const inputs = [...cards.map(c => BigInt(c)), salt];
    
    console.log('[ZKPokerService] Computing commitment for cards:', cards);
    console.log('[ZKPokerService] Salt:', salt.toString());
    
    // Compute Poseidon hash
    const hash = this.poseidon(inputs);
    const hashString = this.poseidon.F.toString(hash);
    
    console.log('[ZKPokerService] Commitment:', hashString);
    
    return hashString;
  }

  /**
   * Generate random salt for commitment
   * 
   * @returns Random 256-bit bigint
   */
  generateSalt(): bigint {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    
    const hex = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return BigInt('0x' + hex);
  }

  /**
   * Generate random poker hand (5 cards)
   * 
   * @returns Array of 5 unique card values (0-51)
   */
  generateRandomHand(): number[] {
    const deck = Array.from({ length: 52 }, (_, i) => i);
    const hand: number[] = [];
    
    // Fisher-Yates shuffle to pick 5 cards
    for (let i = 0; i < 5; i++) {
      const randomIndex = Math.floor(Math.random() * (deck.length - i)) + i;
      [deck[i], deck[randomIndex]] = [deck[randomIndex], deck[i]];
      hand.push(deck[i]);
    }
    
    return hand.sort((a, b) => a - b);
  }

  /**
   * Generate ZK proof for poker game
   * 
   * @param player1Cards - Player 1's 5 cards
   * @param player1Salt - Player 1's salt
   * @param player1Commitment - Player 1's commitment
   * @param player2Cards - Player 2's 5 cards
   * @param player2Salt - Player 2's salt
   * @param player2Commitment - Player 2's commitment
   * @returns Proof data with rankings and winner
   */
  async generateProof(
    player1Cards: number[],
    player1Salt: bigint,
    player1Commitment: string,
    player2Cards: number[],
    player2Salt: bigint,
    player2Commitment: string
  ) {
    if (!this.initialized) await this.initialize();
    
    console.log('[ZKPokerService] Generating ZK proof...');
    console.log('[ZKPokerService] Player 1 cards:', player1Cards);
    console.log('[ZKPokerService] Player 2 cards:', player2Cards);
    
    // Prepare circuit inputs
    const input = {
      player1Commitment: player1Commitment,
      player2Commitment: player2Commitment,
      player1Cards: player1Cards.map(c => String(c)),
      player2Cards: player2Cards.map(c => String(c)),
      player1Salt: player1Salt.toString(),
      player2Salt: player2Salt.toString()
    };

    console.log('[ZKPokerService] Circuit input prepared');

    try {
      // Generate proof using snarkjs
      console.log('[ZKPokerService] Calling snarkjs.groth16.fullProve...');
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        this.wasmPath,
        this.zkeyPath
      );

      console.log('[ZKPokerService] ✅ Proof generated successfully');
      console.log('[ZKPokerService] Public signals:', publicSignals);

      // Parse public signals
      // [0] = player1_commitment
      // [1] = player2_commitment
      // [2] = player1_ranking (0-9)
      // [3] = player2_ranking (0-9)
      // [4] = winner (1 = player1, 2 = player2, 0 = tie)
      
      return {
        proof,
        publicSignals,
        player1Ranking: parseInt(publicSignals[2]),
        player2Ranking: parseInt(publicSignals[3]),
        winner: parseInt(publicSignals[4])
      };
    } catch (err: any) {
      console.error('[ZKPokerService] Proof generation failed:', err);
      throw new Error(`Failed to generate proof: ${err.message}`);
    }
  }

  /**
   * Serialize proof for Soroban contract
   * Converts snarkjs proof format to contract-compatible format
   * 
   * @param proof - Proof from snarkjs
   * @returns Serialized proof object
   */
  serializeProof(proof: any): {
    pi_a: string[];
    pi_b: string[];
    pi_c: string[];
  } {
    // Groth16 proof structure:
    // pi_a: G1 point (2 elements: x, y)
    // pi_b: G2 point (4 elements: x1, x2, y1, y2)
    // pi_c: G1 point (2 elements: x, y)
    
    const proofData = {
      pi_a: proof.pi_a.slice(0, 2).map((v: string) => v.toString()),
      pi_b: [
        ...proof.pi_b[0].slice(0, 2).map((v: string) => v.toString()),
        ...proof.pi_b[1].slice(0, 2).map((v: string) => v.toString())
      ],
      pi_c: proof.pi_c.slice(0, 2).map((v: string) => v.toString())
    };
    
    console.log('[ZKPokerService] Serialized proof:', proofData);
    
    return proofData;
  }

  /**
   * Get card name from card value (0-51)
   * 
   * @param card - Card value (0-51)
   * @returns Card name (e.g., "A♠", "K♥")
   */
  getCardName(card: number): string {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    
    const suit = suits[Math.floor(card / 13)];
    const rank = ranks[card % 13];
    
    return rank + suit;
  }

  /**
   * Get hand ranking name
   * 
   * @param ranking - Ranking value (0-9)
   * @returns Ranking name
   */
  getHandRankingName(ranking: number): string {
    const rankings = [
      'High Card',
      'One Pair',
      'Two Pair',
      'Three of a Kind',
      'Straight',
      'Flush',
      'Full House',
      'Four of a Kind',
      'Straight Flush',
      'Royal Flush'
    ];
    
    return rankings[ranking] || 'Unknown';
  }
}
