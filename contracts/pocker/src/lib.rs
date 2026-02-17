#![no_std]

//! # ZK Poker Game
//!
//! A two-player poker game using Zero-Knowledge proofs for hidden information.
//! Players commit to their hands using Poseidon hash, then reveal with ZK proofs.
//!
//! **ZK Mechanics:**
//! - Card commitments using Poseidon hash (Protocol 25)
//! - Provable reveals with Groth16 proofs
//! - Fair hand ranking verification
//! - No cheating possible after commitment
//!
//! **Game Hub Integration:**
//! This game is Game Hub-aware and enforces all games to be played through the
//! Game Hub contract. Games cannot be started or completed without points involvement.

use soroban_sdk::{
    Address, Bytes, BytesN, Env, IntoVal, Vec, contract, contractclient, contracterror, 
    contractimpl, contracttype, vec, panic_with_error
};

mod verifier;
use verifier::{Groth16Proof as VerifierProof, VerificationKey, verify_groth16};

// Import GameHub contract interface
// This allows us to call into the GameHub contract
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
    AlreadyCommitted = 3,
    NotCommitted = 4,
    AlreadyRevealed = 5,
    GameAlreadyEnded = 6,
    InvalidProof = 7,
    InvalidCommitment = 8,
    NotInPhase = 9,
}

// ============================================================================
// Data Types
// ============================================================================

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Phase {
    Commit,    // Players submit commitments
    Reveal,    // Players reveal cards with ZK proof
    Complete,  // Game finished
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Game {
    pub player1: Address,
    pub player2: Address,
    pub player1_points: i128,
    pub player2_points: i128,
    pub player1_commitment: Option<Bytes>,  // Poseidon hash of hand
    pub player2_commitment: Option<Bytes>,
    pub player1_revealed: bool,
    pub player2_revealed: bool,
    pub player1_ranking: Option<u32>,  // Hand ranking (0-9)
    pub player2_ranking: Option<u32>,
    pub winner: Option<Address>,
    pub phase: Phase,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Groth16Proof {
    pub pi_a: Vec<BytesN<32>>,  // 2 elements (G1 point)
    pub pi_b: Vec<BytesN<32>>,  // 4 elements (G2 point, 2 coordinates)
    pub pi_c: Vec<BytesN<32>>,  // 2 elements (G1 point)
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Game(u32),
    GameHubAddress,
    Admin,
    VerificationKey,  // Store verification key for ZK proofs
}

// ============================================================================
// Storage TTL Management
// ============================================================================
// TTL (Time To Live) ensures game data doesn't expire unexpectedly
// Games are stored in temporary storage with a minimum 30-day retention

/// TTL for game storage (30 days in ledgers, ~5 seconds per ledger)
/// 30 days = 30 * 24 * 60 * 60 / 5 = 518,400 ledgers
const GAME_TTL_LEDGERS: u32 = 518_400;

// ============================================================================
// Contract Definition
// ============================================================================

#[contract]
pub struct PockerContract;

#[contractimpl]
impl PockerContract {
    /// Initialize the contract with GameHub address and admin
    ///
    /// # Arguments
    /// * `admin` - Admin address (can upgrade contract)
    /// * `game_hub` - Address of the GameHub contract
    pub fn __constructor(env: Env, admin: Address, game_hub: Address) {
        // Store admin and GameHub address
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::GameHubAddress, &game_hub);
    }

    /// Start a new game between two players with points.
    /// This creates a session in the Game Hub and locks points before starting the game.
    ///
    /// # Arguments
    /// * `session_id` - Unique session identifier (u32)
    /// * `player1` - Address of first player
    /// * `player2` - Address of second player
    /// * `player1_points` - Points amount committed by player 1
    /// * `player2_points` - Points amount committed by player 2
    pub fn start_game(
        env: Env,
        session_id: u32,
        player1: Address,
        player2: Address,
        player1_points: i128,
        player2_points: i128,
    ) -> Result<(), Error> {
        // Prevent self-play: Player 1 and Player 2 must be different
        if player1 == player2 {
            panic_with_error!(&env, Error::NotPlayer);
        }

        // Require authentication from both players (they consent to committing points)
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

        // Create game in Commit phase
        let game = Game {
            player1: player1.clone(),
            player2: player2.clone(),
            player1_points,
            player2_points,
            player1_commitment: None,
            player2_commitment: None,
            player1_revealed: false,
            player2_revealed: false,
            player1_ranking: None,
            player2_ranking: None,
            winner: None,
            phase: Phase::Commit,
        };

        // Store game in temporary storage with 30-day TTL
        let game_key = DataKey::Game(session_id);
        env.storage().temporary().set(&game_key, &game);

        // Set TTL to ensure game is retained for at least 30 days
        env.storage()
            .temporary()
            .extend_ttl(&game_key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        Ok(())
    }

    /// Submit a commitment for your hand (Poseidon hash)
    /// Players must commit before revealing
    ///
    /// # Arguments
    /// * `session_id` - The session ID of the game
    /// * `player` - Address of the player making the commitment
    /// * `commitment` - Poseidon hash of cards + salt
    pub fn submit_commitment(
        env: Env,
        session_id: u32,
        player: Address,
        commitment: Bytes,
    ) -> Result<(), Error> {
        player.require_auth();

        // Get game from temporary storage
        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        // Check game is in Commit phase
        if game.phase != Phase::Commit {
            return Err(Error::NotInPhase);
        }

        // Store commitment for the appropriate player
        if player == game.player1 {
            if game.player1_commitment.is_some() {
                return Err(Error::AlreadyCommitted);
            }
            game.player1_commitment = Some(commitment);
        } else if player == game.player2 {
            if game.player2_commitment.is_some() {
                return Err(Error::AlreadyCommitted);
            }
            game.player2_commitment = Some(commitment);
        } else {
            return Err(Error::NotPlayer);
        }

        // If both players have committed, move to Reveal phase
        if game.player1_commitment.is_some() && game.player2_commitment.is_some() {
            game.phase = Phase::Reveal;
        }

        // Store updated game in temporary storage
        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        Ok(())
    }

    /// Reveal the winner using a ZK proof
    /// Verifies that revealed cards match commitments and determines winner
    ///
    /// # Arguments
    /// * `session_id` - The session ID of the game
    /// * `proof` - Groth16 ZK proof
    /// * `public_signals` - Public signals from the proof (commitments, rankings, winner)
    ///
    /// # Returns
    /// * `Address` - Address of the winning player
    pub fn reveal_winner(
        env: Env,
        session_id: u32,
        proof: Groth16Proof,
        public_signals: Vec<Bytes>,
    ) -> Result<Address, Error> {
        // Get game from temporary storage
        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        // Check if game already ended (has a winner)
        if let Some(winner) = &game.winner {
            return Ok(winner.clone());
        }

        // Check game is in Reveal phase
        if game.phase != Phase::Reveal {
            return Err(Error::NotInPhase);
        }

        // Check both players have committed
        if game.player1_commitment.is_none() || game.player2_commitment.is_none() {
            return Err(Error::NotCommitted);
        }

        // Verify ZK proof using Protocol 25 primitives
        // public_signals format:
        // [0] = player1_commitment
        // [1] = player2_commitment
        // [2] = player1_ranking
        // [3] = player2_ranking
        // [4] = winner (1 = player1, 2 = player2, 0 = tie)
        
        if public_signals.len() < 5 {
            return Err(Error::InvalidProof);
        }

        // Verify commitments match what was submitted
        let proof_p1_commitment = public_signals.get(0).unwrap();
        let proof_p2_commitment = public_signals.get(1).unwrap();

        if proof_p1_commitment != game.player1_commitment.as_ref().unwrap() {
            return Err(Error::InvalidCommitment);
        }
        if proof_p2_commitment != game.player2_commitment.as_ref().unwrap() {
            return Err(Error::InvalidCommitment);
        }

        // Verify the ZK proof
        Self::verify_groth16_proof(&env, proof, public_signals.clone())?;

        // Extract rankings and winner from public signals
        let p1_ranking = Self::bytes_to_u32(&public_signals.get(2).unwrap());
        let p2_ranking = Self::bytes_to_u32(&public_signals.get(3).unwrap());
        let winner_signal = Self::bytes_to_u32(&public_signals.get(4).unwrap());

        game.player1_ranking = Some(p1_ranking);
        game.player2_ranking = Some(p2_ranking);
        game.player1_revealed = true;
        game.player2_revealed = true;

        // Determine winner based on proof output
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
        game.phase = Phase::Complete;
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

    /// Get game information.
    ///
    /// # Arguments
    /// * `session_id` - The session ID of the game
    ///
    /// # Returns
    /// * `Game` - The game state
    pub fn get_game(env: Env, session_id: u32) -> Result<Game, Error> {
        let key = DataKey::Game(session_id);
        env.storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)
    }

    // ========================================================================
    // ZK Proof Verification (Protocol 25)
    // ========================================================================

    /// Verify a Groth16 ZK proof using Protocol 25 BN254 operations
    fn verify_groth16_proof(
        env: &Env,
        proof: Groth16Proof,
        public_signals: Vec<Bytes>,
    ) -> Result<(), Error> {
        // Load verification key from contract storage
        let vk: VerificationKey = env
            .storage()
            .instance()
            .get(&DataKey::VerificationKey)
            .ok_or(Error::InvalidProof)?;

        // Convert contract Groth16Proof to verifier Groth16Proof
        let verifier_proof = VerifierProof {
            pi_a: proof.pi_a,
            pi_b: proof.pi_b,
            pi_c: proof.pi_c,
        };

        // Verify the proof using the verifier module
        let is_valid = verify_groth16(env, &vk, &verifier_proof, &public_signals)
            .map_err(|_| Error::InvalidProof)?;

        if !is_valid {
            return Err(Error::InvalidProof);
        }

        Ok(())
    }

    /// Convert Bytes to u32 (helper function)
    fn bytes_to_u32(bytes: &Bytes) -> u32 {
        let mut result: u32 = 0;
        let len = bytes.len().min(4);
        
        for i in 0..len {
            let byte = bytes.get(i as u32).unwrap_or(0);
            result |= (byte as u32) << (i * 8);
        }
        
        result
    }

    // ========================================================================
    // Admin Functions
    // ========================================================================

    /// Get the current admin address
    ///
    /// # Returns
    /// * `Address` - The admin address
    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set")
    }

    /// Set a new admin address
    ///
    /// # Arguments
    /// * `new_admin` - The new admin address
    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    /// Get the current GameHub contract address
    ///
    /// # Returns
    /// * `Address` - The GameHub contract address
    pub fn get_hub(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::GameHubAddress)
            .expect("GameHub address not set")
    }

    /// Set a new GameHub contract address
    ///
    /// # Arguments
    /// * `new_hub` - The new GameHub contract address
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

    /// Set the verification key for ZK proof verification
    ///
    /// # Arguments
    /// * `vk` - The verification key from trusted setup
    pub fn set_verification_key(env: Env, vk: VerificationKey) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::VerificationKey, &vk);
    }

    /// Get the current verification key
    ///
    /// # Returns
    /// * `VerificationKey` - The verification key
    pub fn get_verification_key(env: Env) -> Option<VerificationKey> {
        env.storage()
            .instance()
            .get(&DataKey::VerificationKey)
    }

    /// Update the contract WASM hash (upgrade contract)
    ///
    /// # Arguments
    /// * `new_wasm_hash` - The hash of the new WASM binary
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

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod test;
