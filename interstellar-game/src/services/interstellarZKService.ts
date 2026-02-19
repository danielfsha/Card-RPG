import { buildPoseidon } from 'circomlibjs';
import * as snarkjs from 'snarkjs';

/**
 * Interstellar ZK Service
 * Handles commitment generation, proof generation, and verification for Interstellar shooter game
 * 
 * Supports multiple ZK circuits:
 * - Shooting: Verify hit detection with hidden positions
 * - Damage: Verify health updates
 * - Item Collection: Verify item pickup
 * - Win Condition: Verify game winner
 */
export class InterstellarZKService {
  private poseidon: any;
  private initialized: boolean = false;

  // Circuit paths
  private readonly circuits = {
    shooting: {
      wasm: '/circuits/shooting.wasm',
      zkey: '/circuits/shooting_final.zkey'
    },
    damage: {
      wasm: '/circuits/damage.wasm',
      zkey: '/circuits/damage_final.zkey'
    },
    item: {
      wasm: '/circuits/item_collection.wasm',
      zkey: '/circuits/item_collection_final.zkey'
    },
    win: {
      wasm: '/circuits/win_condition.wasm',
      zkey: '/circuits/win_condition_final.zkey'
    }
  };

  constructor() {}

  /**
   * Initialize the service (load Poseidon hash)
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('[InterstellarZK] Initializing Poseidon hash...');
      this.poseidon = await buildPoseidon();
      this.initialized = true;
      console.log('[InterstellarZK] ✅ Initialized successfully');
    } catch (err) {
      console.error('[InterstellarZK] Failed to initialize:', err);
      throw new Error(`Failed to initialize ZK service: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // Position Commitments
  // ============================================================================

  /**
   * Generate commitment for a 3D position using Poseidon hash
   * 
   * @param position - {x, y, z} coordinates
   * @param salt - Random salt for commitment
   * @returns Commitment hash as string
   */
  async commitPosition(position: { x: number; y: number; z: number }, salt: bigint): Promise<string> {
    if (!this.initialized) await this.initialize();
    
    // Create input array: [x, y, z, salt]
    const inputs = [
      BigInt(position.x),
      BigInt(position.y),
      BigInt(position.z),
      salt
    ];
    
    console.log('[InterstellarZK] Computing position commitment:', position);
    console.log('[InterstellarZK] Salt:', salt.toString());
    
    // Compute Poseidon hash with 4 inputs
    const hash = this.poseidon(inputs);
    const hashString = this.poseidon.F.toString(hash);
    
    console.log('[InterstellarZK] Commitment:', hashString);
    
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

  // ============================================================================
  // Shooting Circuit
  // ============================================================================

  /**
   * Generate ZK proof for shooting action
   * 
   * Public Signals:
   * [0] = shooter_position_commitment
   * [1] = target_position_commitment
   * [2] = hit (0=miss, 1=hit)
   * 
   * @param shooterPos - Shooter's position {x, y, z}
   * @param shooterSalt - Shooter's position salt
   * @param shooterCommitment - Shooter's position commitment
   * @param targetPos - Target's position {x, y, z}
   * @param targetSalt - Target's position salt
   * @param targetCommitment - Target's position commitment
   * @param shotDirection - Shot direction vector {x, y, z} (normalized * 1000)
   * @param distance - Distance to target
   * @param maxRange - Maximum weapon range
   * @returns Proof data with hit result
   */
  async generateShootingProof(
    shooterPos: { x: number; y: number; z: number },
    shooterSalt: bigint,
    shooterCommitment: string,
    targetPos: { x: number; y: number; z: number },
    targetSalt: bigint,
    targetCommitment: string,
    shotDirection: { x: number; y: number; z: number },
    distance: number,
    maxRange: number
  ) {
    if (!this.initialized) await this.initialize();
    
    console.log('[InterstellarZK] Generating shooting proof...');
    console.log('[InterstellarZK] Shooter pos:', shooterPos);
    console.log('[InterstellarZK] Target pos:', targetPos);
    console.log('[InterstellarZK] Shot direction:', shotDirection);
    console.log('[InterstellarZK] Distance:', distance, 'Max range:', maxRange);
    
    // Prepare circuit inputs
    const input = {
      shooter_x: String(shooterPos.x),
      shooter_y: String(shooterPos.y),
      shooter_z: String(shooterPos.z),
      target_x: String(targetPos.x),
      target_y: String(targetPos.y),
      target_z: String(targetPos.z),
      shot_direction_x: String(shotDirection.x),
      shot_direction_y: String(shotDirection.y),
      shot_direction_z: String(shotDirection.z),
      distance: String(distance),
      max_range: String(maxRange),
      shooter_salt: shooterSalt.toString(),
      target_salt: targetSalt.toString(),
      shooter_commitment: shooterCommitment,
      target_commitment: targetCommitment
    };

    try {
      console.log('[InterstellarZK] Calling snarkjs.groth16.fullProve (shooting)...');
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        this.circuits.shooting.wasm,
        this.circuits.shooting.zkey
      );

      console.log('[InterstellarZK] ✅ Shooting proof generated');
      console.log('[InterstellarZK] Public signals:', publicSignals);

      // Parse public signals
      const hit = parseInt(publicSignals[2]) === 1;
      
      return {
        proof,
        publicSignals,
        hit,
        shooterCommitment: publicSignals[0],
        targetCommitment: publicSignals[1]
      };
    } catch (err: any) {
      console.error('[InterstellarZK] Shooting proof generation failed:', err);
      throw new Error(`Failed to generate shooting proof: ${err.message}`);
    }
  }

  // ============================================================================
  // Damage Circuit
  // ============================================================================

  /**
   * Generate ZK proof for damage application
   * 
   * Public Signals:
   * [0] = old_health
   * [1] = new_health
   * [2] = weapon_type
   * 
   * @param oldHealth - Health before damage
   * @param damageAmount - Damage to apply
   * @param newHealth - Health after damage
   * @param weaponType - Weapon type (0=pistol, 1=rifle, 2=shotgun, 3=sniper)
   * @returns Proof data
   */
  async generateDamageProof(
    oldHealth: number,
    damageAmount: number,
    newHealth: number,
    weaponType: number
  ) {
    if (!this.initialized) await this.initialize();
    
    console.log('[InterstellarZK] Generating damage proof...');
    console.log('[InterstellarZK] Old health:', oldHealth);
    console.log('[InterstellarZK] Damage:', damageAmount);
    console.log('[InterstellarZK] New health:', newHealth);
    console.log('[InterstellarZK] Weapon type:', weaponType);
    
    const input = {
      old_health: String(oldHealth),
      damage_amount: String(damageAmount),
      new_health: String(newHealth),
      weapon_type: String(weaponType)
    };

    try {
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        this.circuits.damage.wasm,
        this.circuits.damage.zkey
      );

      console.log('[InterstellarZK] ✅ Damage proof generated');
      
      return {
        proof,
        publicSignals,
        oldHealth: parseInt(publicSignals[0]),
        newHealth: parseInt(publicSignals[1]),
        weaponType: parseInt(publicSignals[2])
      };
    } catch (err: any) {
      console.error('[InterstellarZK] Damage proof generation failed:', err);
      throw new Error(`Failed to generate damage proof: ${err.message}`);
    }
  }

  // ============================================================================
  // Item Collection Circuit
  // ============================================================================

  /**
   * Generate ZK proof for item collection
   * 
   * Public Signals:
   * [0] = player_position_commitment
   * [1] = item_type (0=health, 1=ammo, 2=weapon, 3=shield)
   * [2] = collected (0=no, 1=yes)
   * 
   * @param playerPos - Player's position {x, y, z}
   * @param playerSalt - Player's position salt
   * @param playerCommitment - Player's position commitment
   * @param itemPos - Item's position {x, y, z}
   * @param collectionRadius - Collection radius
   * @param itemType - Item type
   * @returns Proof data with collection result
   */
  async generateItemCollectionProof(
    playerPos: { x: number; y: number; z: number },
    playerSalt: bigint,
    playerCommitment: string,
    itemPos: { x: number; y: number; z: number },
    collectionRadius: number,
    itemType: number
  ) {
    if (!this.initialized) await this.initialize();
    
    console.log('[InterstellarZK] Generating item collection proof...');
    console.log('[InterstellarZK] Player pos:', playerPos);
    console.log('[InterstellarZK] Item pos:', itemPos);
    console.log('[InterstellarZK] Collection radius:', collectionRadius);
    console.log('[InterstellarZK] Item type:', itemType);
    
    const input = {
      player_x: String(playerPos.x),
      player_y: String(playerPos.y),
      player_z: String(playerPos.z),
      item_x: String(itemPos.x),
      item_y: String(itemPos.y),
      item_z: String(itemPos.z),
      collection_radius: String(collectionRadius),
      item_type: String(itemType),
      player_salt: playerSalt.toString(),
      player_commitment: playerCommitment
    };

    try {
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        this.circuits.item.wasm,
        this.circuits.item.zkey
      );

      console.log('[InterstellarZK] ✅ Item collection proof generated');
      
      const collected = parseInt(publicSignals[2]) === 1;
      
      return {
        proof,
        publicSignals,
        collected,
        playerCommitment: publicSignals[0],
        itemType: parseInt(publicSignals[1])
      };
    } catch (err: any) {
      console.error('[InterstellarZK] Item collection proof generation failed:', err);
      throw new Error(`Failed to generate item collection proof: ${err.message}`);
    }
  }

  // ============================================================================
  // Win Condition Circuit
  // ============================================================================

  /**
   * Generate ZK proof for win condition
   * 
   * Public Signals:
   * [0] = player1_kills
   * [1] = player2_kills
   * [2] = player1_health
   * [3] = player2_health
   * [4] = winner (0=tie, 1=player1, 2=player2)
   * [5] = reason (0=kills, 1=elimination, 2=time)
   * 
   * @param player1Kills - Player 1's kill count
   * @param player2Kills - Player 2's kill count
   * @param player1Health - Player 1's health
   * @param player2Health - Player 2's health
   * @param killLimit - Kill limit for victory
   * @param timeLimit - Time limit in milliseconds
   * @param elapsedTime - Elapsed time in milliseconds
   * @returns Proof data with winner
   */
  async generateWinProof(
    player1Kills: number,
    player2Kills: number,
    player1Health: number,
    player2Health: number,
    killLimit: number,
    timeLimit: number,
    elapsedTime: number
  ) {
    if (!this.initialized) await this.initialize();
    
    console.log('[InterstellarZK] Generating win condition proof...');
    console.log('[InterstellarZK] P1 kills:', player1Kills, 'health:', player1Health);
    console.log('[InterstellarZK] P2 kills:', player2Kills, 'health:', player2Health);
    console.log('[InterstellarZK] Kill limit:', killLimit);
    console.log('[InterstellarZK] Time:', elapsedTime, '/', timeLimit);
    
    const input = {
      player1_kills: String(player1Kills),
      player2_kills: String(player2Kills),
      player1_health: String(player1Health),
      player2_health: String(player2Health),
      kill_limit: String(killLimit),
      time_limit: String(timeLimit),
      elapsed_time: String(elapsedTime)
    };

    try {
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        this.circuits.win.wasm,
        this.circuits.win.zkey
      );

      console.log('[InterstellarZK] ✅ Win condition proof generated');
      
      const winner = parseInt(publicSignals[4]);
      const reason = parseInt(publicSignals[5]);
      
      return {
        proof,
        publicSignals,
        winner, // 0=tie, 1=player1, 2=player2
        reason, // 0=kills, 1=elimination, 2=time
        player1Kills: parseInt(publicSignals[0]),
        player2Kills: parseInt(publicSignals[1]),
        player1Health: parseInt(publicSignals[2]),
        player2Health: parseInt(publicSignals[3])
      };
    } catch (err: any) {
      console.error('[InterstellarZK] Win condition proof generation failed:', err);
      throw new Error(`Failed to generate win condition proof: ${err.message}`);
    }
  }

  // ============================================================================
  // Proof Serialization
  // ============================================================================

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
    
    console.log('[InterstellarZK] Serialized proof lengths:', {
      pi_a: pi_a.length,
      pi_b: pi_b.length,
      pi_c: pi_c.length
    });
    
    return { pi_a, pi_b, pi_c };
  }

  // ============================================================================
  // Utility Functions
  // ============================================================================

  /**
   * Get weapon name from weapon type
   */
  getWeaponName(weaponType: number): string {
    const weapons = ['Pistol', 'Rifle', 'Shotgun', 'Sniper'];
    return weapons[weaponType] || 'Unknown';
  }

  /**
   * Get weapon damage
   */
  getWeaponDamage(weaponType: number): number {
    const damages = [15, 25, 40, 50]; // Pistol, Rifle, Shotgun, Sniper
    return damages[weaponType] || 0;
  }

  /**
   * Get item name from item type
   */
  getItemName(itemType: number): string {
    const items = ['Health Pack', 'Ammo', 'Weapon Upgrade', 'Shield'];
    return items[itemType] || 'Unknown';
  }

  /**
   * Get win reason name
   */
  getWinReasonName(reason: number): string {
    const reasons = ['Kill Limit Reached', 'Elimination', 'Time Limit'];
    return reasons[reason] || 'Unknown';
  }

  /**
   * Calculate 3D distance between two points
   */
  calculateDistance(
    pos1: { x: number; y: number; z: number },
    pos2: { x: number; y: number; z: number }
  ): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Normalize a 3D vector and scale by 1000 (for circuit input)
   */
  normalizeDirection(direction: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    const length = Math.sqrt(
      direction.x * direction.x +
      direction.y * direction.y +
      direction.z * direction.z
    );
    
    if (length === 0) {
      return { x: 0, y: 0, z: 0 };
    }
    
    return {
      x: Math.round((direction.x / length) * 1000),
      y: Math.round((direction.y / length) * 1000),
      z: Math.round((direction.z / length) * 1000)
    };
  }
}
