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
      throw new Error(`Failed to initialize ZK service: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate commitment for a hand using Poseidon hash
   * 
   * @param cards - Array of 2 card values (0-51) for hole cards
   * @param salt - Random salt for commitment
   * @returns Commitment hash as string
   */
  async commitHand(cards: number[], salt: bigint): Promise<string> {
    if (!this.initialized) await this.initialize();
    
    if (cards.length !== 2) {
      throw new Error('Hand must contain exactly 2 cards (hole cards)');
    }

    // Validate card values
    for (const card of cards) {
      if (card < 0 || card > 51) {
        throw new Error(`Invalid card value: ${card}. Must be 0-51.`);
      }
    }
    
    // Pad to 5 cards with zeros (circuit expects 5 cards)
    // We'll fill in the community cards later when generating proof
    const paddedCards = [...cards, 0, 0, 0];
    
    // Create input array: [card1, card2, 0, 0, 0, salt]
    const inputs = [...paddedCards.map(c => BigInt(c)), salt];
    
    console.log('[ZKPokerService] Computing commitment for cards:', cards);
    console.log('[ZKPokerService] Padded cards:', paddedCards);
    console.log('[ZKPokerService] Salt:', salt.toString());
    
    // Compute Poseidon hash with 6 inputs (5 cards + salt)
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
   * Generate random poker hand (2 hole cards for Texas Hold'em)
   * 
   * @returns Array of 2 unique card values (0-51)
   */
  generateRandomHand(): number[] {
    const deck = Array.from({ length: 52 }, (_, i) => i);
    const hand: number[] = [];
    
    // Fisher-Yates shuffle to pick 2 cards
    for (let i = 0; i < 2; i++) {
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
   * Contract expects:
   * - pi_a: BytesN<64> (G1 point: 32 bytes x + 32 bytes y)
   * - pi_b: BytesN<128> (G2 point: 32 bytes x1 + 32 bytes x2 + 32 bytes y1 + 32 bytes y2)
   * - pi_c: BytesN<64> (G1 point: 32 bytes x + 32 bytes y)
   * 
   * @param proof - Proof from snarkjs
   * @returns Serialized proof object with Buffers
   */
  serializeProof(proof: any): {
    pi_a: Buffer;
    pi_b: Buffer;
    pi_c: Buffer;
  } {
    const bigIntToBuffer32 = (value: string): Buffer => {
      const bn = BigInt(value);
      const hex = bn.toString(16).padStart(64, '0');
      return Buffer.from(hex, 'hex');
    };

    const pi_a_x = bigIntToBuffer32(proof.pi_a[0]);
    const pi_a_y = bigIntToBuffer32(proof.pi_a[1]);
    const pi_a = Buffer.concat([pi_a_x, pi_a_y]);

    const pi_b_x1 = bigIntToBuffer32(proof.pi_b[0][1]);
    const pi_b_x2 = bigIntToBuffer32(proof.pi_b[0][0]);
    const pi_b_y1 = bigIntToBuffer32(proof.pi_b[1][1]);
    const pi_b_y2 = bigIntToBuffer32(proof.pi_b[1][0]);
    const pi_b = Buffer.concat([pi_b_x1, pi_b_x2, pi_b_y1, pi_b_y2]);

    const pi_c_x = bigIntToBuffer32(proof.pi_c[0]);
    const pi_c_y = bigIntToBuffer32(proof.pi_c[1]);
    const pi_c = Buffer.concat([pi_c_x, pi_c_y]);
    
    console.log('[ZKPokerService] Serialized proof lengths:', {
      pi_a: pi_a.length,
      pi_b: pi_b.length,
      pi_c: pi_c.length
    });
    
    return { pi_a, pi_b, pi_c };
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
