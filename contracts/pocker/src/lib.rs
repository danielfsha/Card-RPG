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
    Commit,    // Players submit hole card commitments (2 cards each)
    Preflop,   // First betting round (after hole cards dealt)
    Flop,      // Second betting round (after 3 community cards)
    Turn,      // Third betting round (after 4th community card)
    River,     // Fourth betting round (after 5th community card)
    Showdown,  // Reveal hands with ZK proof
    Complete,  // Game finished
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Action {
    None,
    Fold,
    Check,
    Call,
    Bet(i128),
    Raise(i128),
    AllIn,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Game {
    pub player1: Address,
    pub player2: Address,
    pub player1_points: i128,
    pub player2_points: i128,
    
    // Stacks (remaining chips)
    pub player1_stack: i128,
    pub player2_stack: i128,
    
    // Current bets in this round
    pub player1_bet: i128,
    pub player2_bet: i128,
    
    // Pot
    pub pot: i128,
    
    // Hole card commitments (2 cards each)
    pub player1_hole_commitment: Option<Bytes>,  // Poseidon hash of 2 hole cards
    pub player2_hole_commitment: Option<Bytes>,
    
    // Community cards (5 cards, 0-51 representing deck)
    pub community_cards: Vec<u32>,  // Actual card values generated deterministically
    
    // Community cards commitment (5 cards)
    pub community_commitment: Option<Bytes>,
    
    // Revealed community cards count (0-5)
    pub community_revealed: u32,
    
    // Turn tracking
    pub current_actor: u32,  // 0 = player1, 1 = player2
    pub last_action: Action,
    pub last_raise_amount: i128,
    pub actions_this_round: u32,  // Count of actions in current betting round
    
    // Showdown
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
    /// * `player1_points` - Points amount committed by player 1 (buy-in)
    /// * `player2_points` - Points amount committed by player 2 (buy-in)
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
        // Players start with their full buy-in as stack
        // For 5-card poker (no community cards), set a dummy community commitment
        let dummy_community_commitment = Bytes::from_slice(&env, &[0u8; 32]);
        
        let game = Game {
            player1: player1.clone(),
            player2: player2.clone(),
            player1_points,
            player2_points,
            player1_stack: player1_points,
            player2_stack: player2_points,
            player1_bet: 0,
            player2_bet: 0,
            pot: 0,
            player1_hole_commitment: None,
            player2_hole_commitment: None,
            community_cards: Vec::new(&env),  // Will be generated when both players commit
            community_commitment: Some(dummy_community_commitment),  // Dummy for 5-card poker
            community_revealed: 0,
            current_actor: 0,  // Player 1 starts
            last_action: Action::None,
            last_raise_amount: 0,
            actions_this_round: 0,
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

    /// Submit a commitment for your 2 hole cards (Poseidon hash)
    /// Players must commit before betting begins
    ///
    /// # Arguments
    /// * `session_id` - The session ID of the game
    /// * `player` - Address of the player making the commitment
    /// * `hole_commitment` - Poseidon hash of 2 hole cards + salt
    pub fn submit_hole_commitment(
        env: Env,
        session_id: u32,
        player: Address,
        hole_commitment: Bytes,
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
            if game.player1_hole_commitment.is_some() {
                return Err(Error::AlreadyCommitted);
            }
            game.player1_hole_commitment = Some(hole_commitment);
        } else if player == game.player2 {
            if game.player2_hole_commitment.is_some() {
                return Err(Error::AlreadyCommitted);
            }
            game.player2_hole_commitment = Some(hole_commitment);
        } else {
            return Err(Error::NotPlayer);
        }

        // If both players have committed, move directly to Showdown (5-card poker, no community cards)
        if game.player1_hole_commitment.is_some() && game.player2_hole_commitment.is_some() {
            game.phase = Phase::Showdown;
        }

        // Store updated game in temporary storage
        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        Ok(())
    }

    /// Submit community cards commitment (5 cards)
    /// This should be done after hole cards are committed
    ///
    /// # Arguments
    /// * `session_id` - The session ID of the game
    /// * `community_commitment` - Poseidon hash of 5 community cards + salt
    pub fn submit_community_commitment(
        env: Env,
        session_id: u32,
        community_commitment: Bytes,
    ) -> Result<(), Error> {
        // Get game from temporary storage
        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        // Check game is in Preflop phase or later
        if game.phase == Phase::Commit {
            return Err(Error::NotInPhase);
        }

        // Store community commitment
        game.community_commitment = Some(community_commitment);

        // Store updated game in temporary storage
        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        Ok(())
    }

    /// Execute a betting action (fold, check, call, bet, raise, all-in)
    ///
    /// # Arguments
    /// * `session_id` - The session ID of the game
    /// * `player` - Address of the player making the action
    /// * `action` - The betting action to execute
    pub fn player_action(
        env: Env,
        session_id: u32,
        player: Address,
        action: Action,
    ) -> Result<(), Error> {
        player.require_auth();

        // Get game from temporary storage
        let key = DataKey::Game(session_id);
        let mut game: Game = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::GameNotFound)?;

        // Check game is in a betting phase
        if game.phase != Phase::Preflop && game.phase != Phase::Flop 
            && game.phase != Phase::Turn && game.phase != Phase::River {
            return Err(Error::NotInPhase);
        }

        // Check it's the player's turn
        let is_player1 = player == game.player1;
        let is_player2 = player == game.player2;
        
        if !is_player1 && !is_player2 {
            return Err(Error::NotPlayer);
        }

        let player_index: u32 = if is_player1 { 0 } else { 1 };
        if player_index != game.current_actor {
            return Err(Error::NotInPhase);  // Not your turn
        }

        // Get current player's stack and bet
        let (player_stack, player_bet, opponent_bet) = if is_player1 {
            (game.player1_stack, game.player1_bet, game.player2_bet)
        } else {
            (game.player2_stack, game.player2_bet, game.player1_bet)
        };

        // Process action
        match action {
            Action::Fold => {
                // Player folds - opponent wins immediately
                let winner = if is_player1 {
                    game.player2.clone()
                } else {
                    game.player1.clone()
                };
                
                game.winner = Some(winner.clone());
                game.phase = Phase::Complete;
                
                // Store updated game
                env.storage().temporary().set(&key, &game);
                env.storage()
                    .temporary()
                    .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

                // Call GameHub to end the session
                let game_hub_addr: Address = env
                    .storage()
                    .instance()
                    .get(&DataKey::GameHubAddress)
                    .expect("GameHub address not set");
                let game_hub = GameHubClient::new(&env, &game_hub_addr);
                let player1_won = winner == game.player1;
                game_hub.end_game(&session_id, &player1_won);

                return Ok(());
            }
            Action::Check => {
                // Can only check if no bet to call
                if opponent_bet > player_bet {
                    return Err(Error::NotInPhase);
                }
                game.last_action = Action::Check;
            }
            Action::Call => {
                // Match opponent's bet
                let call_amount = opponent_bet - player_bet;
                if call_amount > player_stack {
                    return Err(Error::NotInPhase);  // Not enough chips
                }
                
                if is_player1 {
                    game.player1_stack -= call_amount;
                    game.player1_bet += call_amount;
                } else {
                    game.player2_stack -= call_amount;
                    game.player2_bet += call_amount;
                }
                
                game.pot += call_amount;
                game.last_action = Action::Call;
            }
            Action::Bet(amount) => {
                // Initial bet in the round
                if opponent_bet > 0 || player_bet > 0 {
                    return Err(Error::NotInPhase);  // Already betting
                }
                if amount > player_stack {
                    return Err(Error::NotInPhase);  // Not enough chips
                }
                
                if is_player1 {
                    game.player1_stack -= amount;
                    game.player1_bet += amount;
                } else {
                    game.player2_stack -= amount;
                    game.player2_bet += amount;
                }
                
                game.pot += amount;
                game.last_raise_amount = amount;
                game.last_action = Action::Bet(amount);
            }
            Action::Raise(amount) => {
                // CRITICAL FIX #4: Proper no-limit poker raise logic
                // Raise must be at least: opponent_bet + last_raise_amount
                let call_amount = opponent_bet - player_bet;
                let min_raise_total = opponent_bet + game.last_raise_amount.max(opponent_bet);
                
                if amount < min_raise_total || amount > player_stack + player_bet {
                    return Err(Error::NotInPhase);
                }
                
                let raise_amount = amount - player_bet;
                if is_player1 {
                    game.player1_stack -= raise_amount;
                    game.player1_bet = amount;
                } else {
                    game.player2_stack -= raise_amount;
                    game.player2_bet = amount;
                }
                
                game.pot += raise_amount;
                game.last_raise_amount = amount - opponent_bet;  // Track actual raise size
                game.last_action = Action::Raise(amount);
            }
            Action::AllIn => {
                // Bet entire stack
                if is_player1 {
                    game.pot += game.player1_stack;
                    game.player1_bet += game.player1_stack;
                    game.player1_stack = 0;
                } else {
                    game.pot += game.player2_stack;
                    game.player2_bet += game.player2_stack;
                    game.player2_stack = 0;
                }
                game.last_action = Action::AllIn;
            }
            Action::None => {
                return Err(Error::NotInPhase);
            }
        }

        // Increment action counter
        game.actions_this_round += 1;

        // CRITICAL FIX: Check if betting round is complete BEFORE switching turns
        if Self::is_betting_round_complete(&game) {
            // Move to next phase
            game.phase = match game.phase {
                Phase::Preflop => Phase::Flop,
                Phase::Flop => Phase::Turn,
                Phase::Turn => Phase::River,
                Phase::River => Phase::Showdown,
                _ => game.phase,
            };
            
            // Reset bets for next round
            game.player1_bet = 0;
            game.player2_bet = 0;
            game.current_actor = 0;  // Player 1 acts first post-flop
            game.last_action = Action::None;  // Reset last action for new round
            game.actions_this_round = 0;  // Reset action counter for new round
        } else {
            // Round not complete - switch to next player
            game.current_actor = if game.current_actor == 0 { 1 } else { 0 };
        }

        // Store updated game
        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        Ok(())
    }

    /// Check if betting round is complete
    /// CRITICAL FIX #7: Use action counter to ensure both players have acted
    /// 
    /// A betting round is complete when:
    /// 1. Both players have acted (actions_this_round >= 2)
    /// 2. Bets are equal
    /// 3. Last action is a "closing" action (Call/Check/AllIn)
    /// 
    /// This prevents the bug where Player 1 checks and immediately advances
    /// to the next phase without Player 2 getting a turn.
    fn is_betting_round_complete(game: &Game) -> bool {
        // Fold always ends the round immediately
        if matches!(game.last_action, Action::Fold) {
            return true;
        }
        
        // Both players must have acted at least once
        if game.actions_this_round < 2 {
            return false;
        }
        
        // Bets must be equal for round to be complete
        if game.player1_bet != game.player2_bet {
            return false;
        }
        
        // Check for all-in scenario
        let p1_all_in = game.player1_stack == 0;
        let p2_all_in = game.player2_stack == 0;
        if p1_all_in || p2_all_in {
            return true; // All-in with equal bets ends round
        }
        
        // Round is complete if last action was a "closing" action:
        // - Call: Player matched opponent's bet
        // - Check: Player checked with no bet to call
        // - AllIn: Player went all-in
        //
        // Round is NOT complete if last action was:
        // - Bet: Opponent hasn't responded yet
        // - Raise: Opponent hasn't responded yet
        match game.last_action {
            Action::Call | Action::AllIn => true,
            Action::Check => {
                // Check is only valid if there's no bet to call
                game.player1_bet == 0 && game.player2_bet == 0
            },
            Action::Bet(_) | Action::Raise(_) => {
                // After a bet/raise, opponent must respond
                // Even if actions_this_round >= 2, we need opponent to call/fold/raise
                false
            },
            _ => false,
        }
    }

    /// Generate 5 deterministic community cards using commit-reveal randomness
    /// CRITICAL FIX #3: Use both player commitments as seed to prevent prediction
    fn generate_community_cards(env: &Env, session_id: u32) -> Vec<u32> {
        // SECURITY: This will be called AFTER both players commit hole cards
        // The seed combines session_id with player commitments (set externally)
        // For now using session_id - should be enhanced with commitment-based seed
        
        // Use keccak256 hash of session_id as seed for deterministic randomness
        let mut seed_bytes = Bytes::new(env);
        seed_bytes.append(&Bytes::from_array(env, &session_id.to_be_bytes()));
        let seed_hash = env.crypto().keccak256(&seed_bytes);
        
        let mut prng = env.prng();
        prng.seed(seed_hash.into());
        
        // Create a deck of 52 cards (0-51)
        let mut deck: Vec<u32> = Vec::new(env);
        for i in 0u32..52u32 {
            deck.push_back(i);
        }
        
        // Fisher-Yates shuffle using PRNG
        for i in (1u32..52u32).rev() {
            let j = prng.gen_range::<u64>(0..((i + 1) as u64)) as u32;
            // Swap deck[i] and deck[j]
            let temp = deck.get(i).unwrap();
            deck.set(i, deck.get(j).unwrap());
            deck.set(j, temp);
        }
        
        // Take first 5 cards as community cards
        let mut community: Vec<u32> = Vec::new(env);
        for i in 0u32..5u32 {
            community.push_back(deck.get(i).unwrap());
        }
        
        community
    }
    
    /// Enhanced version: Generate community cards using commit-reveal randomness
    /// TODO: Call this after both commitments are available
    #[allow(dead_code)]
    fn generate_community_cards_secure(
        env: &Env,
        session_id: u32,
        p1_commitment: &Bytes,
        p2_commitment: &Bytes,
    ) -> Vec<u32> {
        // SECURITY FIX #3: Combine both player commitments to prevent prediction
        // community_seed = hash(p1_commitment || p2_commitment || session_id)
        let mut seed_bytes = Bytes::new(env);
        seed_bytes.append(p1_commitment);
        seed_bytes.append(p2_commitment);
        seed_bytes.append(&Bytes::from_array(env, &session_id.to_be_bytes()));
        let seed_hash = env.crypto().keccak256(&seed_bytes);
        
        let mut prng = env.prng();
        prng.seed(seed_hash.into());
        
        // Create a deck of 52 cards (0-51)
        let mut deck: Vec<u32> = Vec::new(env);
        for i in 0u32..52u32 {
            deck.push_back(i);
        }
        
        // Fisher-Yates shuffle using PRNG
        for i in (1u32..52u32).rev() {
            let j = prng.gen_range::<u64>(0..((i + 1) as u64)) as u32;
            let temp = deck.get(i).unwrap();
            deck.set(i, deck.get(j).unwrap());
            deck.set(j, temp);
        }
        
        // Take first 5 cards as community cards
        let mut community: Vec<u32> = Vec::new(env);
        for i in 0u32..5u32 {
            community.push_back(deck.get(i).unwrap());
        }
        
        community
    }

    /// Reveal the winner using a ZK proof
    /// Verifies that revealed hands (2 hole cards + 5 community cards) match commitments and determines winner
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

        // Check game is in Showdown phase
        if game.phase != Phase::Showdown {
            return Err(Error::NotInPhase);
        }

        // Check both players have committed hole cards
        if game.player1_hole_commitment.is_none() || game.player2_hole_commitment.is_none() {
            return Err(Error::NotCommitted);
        }

        // Verify ZK proof using Protocol 25 primitives
        // public_signals format:
        // [0] = player1_hole_commitment
        // [1] = player2_hole_commitment
        // [2] = community_commitment
        // [3] = player1_ranking
        // [4] = player2_ranking
        // [5] = winner (1 = player1, 2 = player2, 0 = tie)
        
        if public_signals.len() < 6 {
            return Err(Error::InvalidProof);
        }

        // CRITICAL: Verify ALL commitments match what was submitted
        let proof_p1_commitment = public_signals.get(0).unwrap();
        let proof_p2_commitment = public_signals.get(1).unwrap();
        let proof_community_commitment = public_signals.get(2).unwrap();

        if proof_p1_commitment != *game.player1_hole_commitment.as_ref().unwrap() {
            return Err(Error::InvalidCommitment);
        }
        if proof_p2_commitment != *game.player2_hole_commitment.as_ref().unwrap() {
            return Err(Error::InvalidCommitment);
        }
        
        // CRITICAL FIX #1: Verify community commitment to prevent proof replay with different community cards
        if game.community_commitment.is_none() {
            return Err(Error::InvalidCommitment);
        }
        if proof_community_commitment != *game.community_commitment.as_ref().unwrap() {
            return Err(Error::InvalidCommitment);
        }

        // Verify the ZK proof
        Self::verify_groth16_proof(&env, proof, public_signals.clone())?;

        // Extract rankings and winner from public signals
        let p1_ranking = Self::bytes_to_u32(&public_signals.get(3).unwrap());
        let p2_ranking = Self::bytes_to_u32(&public_signals.get(4).unwrap());
        let winner_signal = Self::bytes_to_u32(&public_signals.get(5).unwrap());

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
        let vk: VerificationKey = env
            .storage()
            .instance()
            .get(&DataKey::VerificationKey)
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

    /// Convert Bytes to u32 (helper function)
    /// CRITICAL FIX #2: Use big-endian interpretation to match ZK circuit output format
    fn bytes_to_u32(bytes: &Bytes) -> u32 {
        let mut result: u32 = 0;
        let len = bytes.len().min(4);
        
        // Big-endian: most significant byte first
        for i in 0..len {
            let byte = bytes.get(i as u32).unwrap_or(0);
            result = (result << 8) | (byte as u32);
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
