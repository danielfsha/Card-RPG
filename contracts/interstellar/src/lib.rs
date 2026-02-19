#![no_std]

//! # Interstellar Shooter Game
//!
//! A two-player 3D shooter game using Zero-Knowledge proofs for hidden positions and actions.
//! Players spawn in an arena, collect items, and battle until one player wins.
//!
//! **ZK Mechanics:**
//! - Position commitments using Poseidon hash
//! - Provable shooting with hit detection
//! - Fair damage calculation verification
//! - Item collection verification
//! - Win condition determination

use soroban_sdk::{
    Address, Bytes, BytesN, Env, IntoVal, Vec, contract, contractclient, contracterror, 
    contractimpl, contracttype, vec, panic_with_error
};

mod verifier;
use verifier::{Groth16Proof as VerifierProof, VerificationKey, verify_groth16};

// Import GameHub contract interface
#[contractclient(name = "GameHubClient")]
pub trait GameHub {
    fn start_game(
        env: Env,
        game_id: Address,
        session_id: u32,
        player1: Address,
        player2: Address,
        player1_points: i128,
        player2_points: i128,
    );

    fn end_game(
        env: Env,
        session_id: u32,
        player1_won: bool
    );
}

// ============================================================================
// Errors
// ============================================================================

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    GameNotFound = 1,
    NotPlayer = 2,
    GameAlreadyEnded = 3,
    InvalidProof = 4,
    InvalidAction = 5,
    NotYourTurn = 6,
    InvalidPosition = 7,
    InvalidShot = 8,
    InvalidDamage = 9,
    InvalidItemCollection = 10,
}

// ============================================================================
// Data Types
// ============================================================================

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum GamePhase {
    Active,    // Game in progress
    Complete,  // Game finished
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Position {
    pub x: i32,
    pub y: i32,
    pub z: i32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlayerState {
    pub health: i32,
    pub kills: u32,
    pub position_commitment: Option<Bytes>,  // Poseidon hash of position + salt
    pub weapon_type: u32,  // 0=pistol, 1=rifle, 2=shotgun, 3=sniper
    pub ammo: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Game {
    pub player1: Address,
    pub player2: Address,
    pub player1_points: i128,
    pub player2_points: i128,
    
    // Player states
    pub player1_state: PlayerState,
    pub player2_state: PlayerState,
    
    // Game settings
    pub kill_limit: u32,
    pub time_limit: u64,  // milliseconds
    pub start_time: u64,
    
    // Turn tracking
    pub current_turn: u32,  // Increments with each action
    pub last_actor: u32,  // 0 = player1, 1 = player2
    
    // Winner
    pub winner: Option<Address>,
    pub phase: GamePhase,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Groth16Proof {
    pub pi_a: BytesN<64>,
    pub pi_b: BytesN<128>,
    pub pi_c: BytesN<64>,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Game(u32),
    GameHubAddress,
    Admin,
    ShootingVerificationKey,  // VK for shooting circuit
    DamageVerificationKey,    // VK for damage circuit
    ItemVerificationKey,      // VK for item collection circuit
    WinVerificationKey,       // VK for win condition circuit
}

// ============================================================================
// Storage TTL Management
// ============================================================================

/// TTL for game storage (30 days in ledgers, ~5 seconds per ledger)
const GAME_TTL_LEDGERS: u32 = 518_400;

// ============================================================================
// Contract Definition
// ============================================================================

#[contract]
pub struct InterstellarContract;

#[contractimpl]
impl InterstellarContract {
    /// Initialize the contract with GameHub address and admin
    pub fn __constructor(env: Env, admin: Address, game_hub: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::GameHubAddress, &game_hub);
    }

    /// Start a new game between two players
    ///
    /// # Arguments
    /// * `session_id` - Unique session identifier
    /// * `player1` - Address of first player
    /// * `player2` - Address of second player
    /// * `player1_points` - Points committed by player 1
    /// * `player2_points` - Points committed by player 2
    /// * `kill_limit` - Number of kills to win (default: 10)
    /// * `time_limit` - Time limit in milliseconds (default: 300000 = 5 minutes)
    pub fn start_game(
        env: Env,
        session_id: u32,
        player1: Address,
        player2: Address,
        player1_points: i128,
        player2_points: i128,
        kill_limit: u32,
        time_limit: u64,
    ) -> Result<(), Error> {
        // Prevent self-play
        if player1 == player2 {
            panic_with_error!(&env, Error::NotPlayer);
        }

        // Require authentication from both players
        player1.require_auth_for_args(vec![&env, session_id.into_val(&env), player1_points.into_val(&env)]);
        player2.require_auth_for_args(vec![&env, session_id.into_val(&env), player2_points.into_val(&env)]);

        // Get GameHub address
        let game_hub_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::GameHubAddress)
            .expect("GameHub address not set");

        // Create GameHub client
        let game_hub = GameHubClient::new(&env, &game_hub_addr);

        // Call Game Hub to start the session and lock points
        game_hub.start_game(
            &env.current_contract_address(),
            &session_id,
            &player1,
            &player2,
            &player1_points,
            &player2_points,
        );

        // Create game in Active phase
        let game = Game {
            player1: player1.clone(),
            player2: player2.clone(),
            player1_points,
            player2_points,
            player1_state: PlayerState {
                health: 100,
                kills: 0,
                position_commitment: None,
                weapon_type: 0,  // Start with pistol
                ammo: 50,
            },
            player2_state: PlayerState {
                health: 100,
                kills: 0,
                position_commitment: None,
                weapon_type: 0,  // Start with pistol
                ammo: 50,
            },
            kill_limit,
            time_limit,
            start_time: env.ledger().timestamp(),
            current_turn: 0,
            last_actor: 0,
            winner: None,
            phase: GamePhase::Active,
        };

        // Store game in temporary storage with 30-day TTL
        let game_key = DataKey::Game(session_id);
        env.storage().temporary().set(&game_key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&game_key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        Ok(())
    }

    /// Submit a position commitment (Poseidon hash of x, y, z, salt)
    ///
    /// # Arguments
    /// * `session_id` - The session ID of the game
    /// * `player` - Address of the player
    /// * `position_commitment` - Poseidon hash of position + salt
    pub fn submit_position(
        env: Env,
        session_id: u32,
        player: Address,
        position_commitment: Bytes,
    ) -> Result<(), Error> {
        player.require_auth();

        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        if game.phase != GamePhase::Active {
            return Err(Error::GameAlreadyEnded);
        }

        // Store commitment for the appropriate player
        if player == game.player1 {
            game.player1_state.position_commitment = Some(position_commitment);
        } else if player == game.player2 {
            game.player2_state.position_commitment = Some(position_commitment);
        } else {
            return Err(Error::NotPlayer);
        }

        // Store updated game
        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        Ok(())
    }

    /// Execute a shooting action with ZK proof
    ///
    /// # Arguments
    /// * `session_id` - The session ID of the game
    /// * `shooter` - Address of the shooting player
    /// * `proof` - Groth16 ZK proof of valid shot
    /// * `public_signals` - Public signals (shooter_commitment, target_commitment, hit)
    ///
    /// # Public Signals Format:
    /// [0] = shooter_position_commitment
    /// [1] = target_position_commitment
    /// [2] = hit (0=miss, 1=hit)
    pub fn shoot(
        env: Env,
        session_id: u32,
        shooter: Address,
        proof: Groth16Proof,
        public_signals: Vec<Bytes>,
    ) -> Result<bool, Error> {
        shooter.require_auth();

        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        if game.phase != GamePhase::Active {
            return Err(Error::GameAlreadyEnded);
        }

        // Determine shooter and target
        let is_player1 = shooter == game.player1;
        if !is_player1 && shooter != game.player2 {
            return Err(Error::NotPlayer);
        }

        // Verify proof using shooting verification key
        Self::verify_shooting_proof(&env, proof, public_signals.clone())?;

        // Extract hit result from public signals
        if public_signals.len() < 3 {
            return Err(Error::InvalidProof);
        }

        let hit = Self::bytes_to_u32(&public_signals.get(2).unwrap()) == 1;

        // Update turn counter
        game.current_turn += 1;
        game.last_actor = if is_player1 { 0 } else { 1 };

        // Store updated game
        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        Ok(hit)
    }

    /// Apply damage with ZK proof
    ///
    /// # Arguments
    /// * `session_id` - The session ID of the game
    /// * `target` - Address of the player taking damage
    /// * `proof` - Groth16 ZK proof of valid damage calculation
    /// * `public_signals` - Public signals (old_health, new_health, weapon_type)
    ///
    /// # Public Signals Format:
    /// [0] = old_health
    /// [1] = new_health
    /// [2] = weapon_type
    pub fn apply_damage(
        env: Env,
        session_id: u32,
        target: Address,
        proof: Groth16Proof,
        public_signals: Vec<Bytes>,
    ) -> Result<(), Error> {
        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        if game.phase != GamePhase::Active {
            return Err(Error::GameAlreadyEnded);
        }

        // Verify proof using damage verification key
        Self::verify_damage_proof(&env, proof, public_signals.clone())?;

        // Extract damage info from public signals
        if public_signals.len() < 3 {
            return Err(Error::InvalidProof);
        }

        let new_health = Self::bytes_to_i32(&public_signals.get(1).unwrap());

        // Update target's health
        let is_player1 = target == game.player1;
        if is_player1 {
            game.player1_state.health = new_health;
            
            // Check if player died
            if new_health <= 0 {
                game.player2_state.kills += 1;
            }
        } else if target == game.player2 {
            game.player2_state.health = new_health;
            
            // Check if player died
            if new_health <= 0 {
                game.player1_state.kills += 1;
            }
        } else {
            return Err(Error::NotPlayer);
        }

        // Store updated game
        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        Ok(())
    }

    /// Collect an item with ZK proof
    ///
    /// # Arguments
    /// * `session_id` - The session ID of the game
    /// * `player` - Address of the player collecting the item
    /// * `proof` - Groth16 ZK proof of valid item collection
    /// * `public_signals` - Public signals (player_position, item_type, collected)
    ///
    /// # Public Signals Format:
    /// [0] = player_position_commitment
    /// [1] = item_type (0=health, 1=ammo, 2=weapon, 3=shield)
    /// [2] = collected (0=no, 1=yes)
    pub fn collect_item(
        env: Env,
        session_id: u32,
        player: Address,
        proof: Groth16Proof,
        public_signals: Vec<Bytes>,
    ) -> Result<(), Error> {
        player.require_auth();

        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        if game.phase != GamePhase::Active {
            return Err(Error::GameAlreadyEnded);
        }

        // Verify proof using item verification key
        Self::verify_item_proof(&env, proof, public_signals.clone())?;

        // Extract item info from public signals
        if public_signals.len() < 3 {
            return Err(Error::InvalidProof);
        }

        let item_type = Self::bytes_to_u32(&public_signals.get(1).unwrap());
        let collected = Self::bytes_to_u32(&public_signals.get(2).unwrap()) == 1;

        if !collected {
            return Err(Error::InvalidItemCollection);
        }

        // Apply item effect
        let is_player1 = player == game.player1;
        let player_state = if is_player1 {
            &mut game.player1_state
        } else if player == game.player2 {
            &mut game.player2_state
        } else {
            return Err(Error::NotPlayer);
        };

        match item_type {
            0 => {
                // Health pack: +25 health (max 100)
                player_state.health = (player_state.health + 25).min(100);
            }
            1 => {
                // Ammo: +30 ammo
                player_state.ammo += 30;
            }
            2 => {
                // Weapon upgrade
                player_state.weapon_type = (player_state.weapon_type + 1).min(3);
            }
            3 => {
                // Shield: +50 health (can exceed 100)
                player_state.health += 50;
            }
            _ => return Err(Error::InvalidItemCollection),
        }

        // Store updated game
        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        Ok(())
    }

    /// Determine winner with ZK proof
    ///
    /// # Arguments
    /// * `session_id` - The session ID of the game
    /// * `proof` - Groth16 ZK proof of win condition
    /// * `public_signals` - Public signals (p1_kills, p2_kills, p1_health, p2_health, winner)
    ///
    /// # Public Signals Format:
    /// [0] = player1_kills
    /// [1] = player2_kills
    /// [2] = player1_health
    /// [3] = player2_health
    /// [4] = winner (0=tie, 1=player1, 2=player2)
    /// [5] = reason (0=kills, 1=elimination, 2=time)
    pub fn determine_winner(
        env: Env,
        session_id: u32,
        proof: Groth16Proof,
        public_signals: Vec<Bytes>,
    ) -> Result<Address, Error> {
        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        // Check if game already ended
        if let Some(winner) = &game.winner {
            return Ok(winner.clone());
        }

        // Verify proof using win verification key
        Self::verify_win_proof(&env, proof, public_signals.clone())?;

        // Extract winner from public signals
        if public_signals.len() < 6 {
            return Err(Error::InvalidProof);
        }

        let winner_signal = Self::bytes_to_u32(&public_signals.get(4).unwrap());

        let winner = match winner_signal {
            1 => game.player1.clone(),
            2 => game.player2.clone(),
            _ => {
                // Tie - use deterministic tiebreaker (player1 wins)
                game.player1.clone()
            }
        };

        // Update game with winner
        game.winner = Some(winner.clone());
        game.phase = GamePhase::Complete;
        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        // Get GameHub address
        let game_hub_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::GameHubAddress)
            .expect("GameHub address not set");

        // Create GameHub client
        let game_hub = GameHubClient::new(&env, &game_hub_addr);

        // Call GameHub to end the session
        let player1_won = winner == game.player1;
        game_hub.end_game(&session_id, &player1_won);

        Ok(winner)
    }

    /// Get game information
    pub fn get_game(env: Env, session_id: u32) -> Result<Game, Error> {
        let key = DataKey::Game(session_id);
        env.storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)
    }

    // ========================================================================
    // ZK Proof Verification (BN254 Groth16)
    // ========================================================================

    /// Verify shooting proof
    fn verify_shooting_proof(
        env: &Env,
        proof: Groth16Proof,
        public_signals: Vec<Bytes>,
    ) -> Result<(), Error> {
        let vk: VerificationKey = env
            .storage()
            .instance()
            .get(&DataKey::ShootingVerificationKey)
            .ok_or(Error::InvalidProof)?;

        let verifier_proof = VerifierProof {
            pi_a: proof.pi_a,
            pi_b: proof.pi_b,
            pi_c: proof.pi_c,
        };

        let is_valid = verify_groth16(env, &vk, &verifier_proof, &public_signals)
            .map_err(|_| Error::InvalidProof)?;

        if !is_valid {
            return Err(Error::InvalidProof);
        }

        Ok(())
    }

    /// Verify damage proof
    fn verify_damage_proof(
        env: &Env,
        proof: Groth16Proof,
        public_signals: Vec<Bytes>,
    ) -> Result<(), Error> {
        let vk: VerificationKey = env
            .storage()
            .instance()
            .get(&DataKey::DamageVerificationKey)
            .ok_or(Error::InvalidProof)?;

        let verifier_proof = VerifierProof {
            pi_a: proof.pi_a,
            pi_b: proof.pi_b,
            pi_c: proof.pi_c,
        };

        let is_valid = verify_groth16(env, &vk, &verifier_proof, &public_signals)
            .map_err(|_| Error::InvalidProof)?;

        if !is_valid {
            return Err(Error::InvalidProof);
        }

        Ok(())
    }

    /// Verify item collection proof
    fn verify_item_proof(
        env: &Env,
        proof: Groth16Proof,
        public_signals: Vec<Bytes>,
    ) -> Result<(), Error> {
        let vk: VerificationKey = env
            .storage()
            .instance()
            .get(&DataKey::ItemVerificationKey)
            .ok_or(Error::InvalidProof)?;

        let verifier_proof = VerifierProof {
            pi_a: proof.pi_a,
            pi_b: proof.pi_b,
            pi_c: proof.pi_c,
        };

        let is_valid = verify_groth16(env, &vk, &verifier_proof, &public_signals)
            .map_err(|_| Error::InvalidProof)?;

        if !is_valid {
            return Err(Error::InvalidProof);
        }

        Ok(())
    }

    /// Verify win condition proof
    fn verify_win_proof(
        env: &Env,
        proof: Groth16Proof,
        public_signals: Vec<Bytes>,
    ) -> Result<(), Error> {
        let vk: VerificationKey = env
            .storage()
            .instance()
            .get(&DataKey::WinVerificationKey)
            .ok_or(Error::InvalidProof)?;

        let verifier_proof = VerifierProof {
            pi_a: proof.pi_a,
            pi_b: proof.pi_b,
            pi_c: proof.pi_c,
        };

        let is_valid = verify_groth16(env, &vk, &verifier_proof, &public_signals)
            .map_err(|_| Error::InvalidProof)?;

        if !is_valid {
            return Err(Error::InvalidProof);
        }

        Ok(())
    }

    /// Convert Bytes to u32 (big-endian)
    fn bytes_to_u32(bytes: &Bytes) -> u32 {
        let mut result: u32 = 0;
        let len = bytes.len().min(4);
        
        for i in 0..len {
            let byte = bytes.get(i as u32).unwrap_or(0);
            result = (result << 8) | (byte as u32);
        }
        
        result
    }

    /// Convert Bytes to i32 (big-endian, signed)
    fn bytes_to_i32(bytes: &Bytes) -> i32 {
        let mut result: i32 = 0;
        let len = bytes.len().min(4);
        
        for i in 0..len {
            let byte = bytes.get(i as u32).unwrap_or(0);
            result = (result << 8) | (byte as i32);
        }
        
        result
    }

    // ========================================================================
    // Admin Functions
    // ========================================================================

    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set")
    }

    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    pub fn get_hub(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::GameHubAddress)
            .expect("GameHub address not set")
    }

    pub fn set_hub(env: Env, new_hub: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::GameHubAddress, &new_hub);
    }

    /// Set verification key for shooting circuit
    pub fn set_shooting_vk(env: Env, vk: VerificationKey) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::ShootingVerificationKey, &vk);
    }

    /// Set verification key for damage circuit
    pub fn set_damage_vk(env: Env, vk: VerificationKey) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::DamageVerificationKey, &vk);
    }

    /// Set verification key for item collection circuit
    pub fn set_item_vk(env: Env, vk: VerificationKey) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::ItemVerificationKey, &vk);
    }

    /// Set verification key for win condition circuit
    pub fn set_win_vk(env: Env, vk: VerificationKey) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::WinVerificationKey, &vk);
    }

    /// Update the contract WASM hash (upgrade contract)
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();

        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

#[cfg(test)]
mod test;
