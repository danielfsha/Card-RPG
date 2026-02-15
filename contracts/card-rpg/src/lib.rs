#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, symbol_short, Address, Env, Bytes, Vec, panic_with_error
};

// ---------------------------------------------------------------------------
// Game Hub Interface
// ---------------------------------------------------------------------------
#[soroban_sdk::contractclient(name = "GameHubClient")]
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

    fn end_game(env: Env, session_id: u32, player1_won: bool);
}

// ---------------------------------------------------------------------------
// Error Codes
// ---------------------------------------------------------------------------
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    NotInPhase = 3,
    NotPlayer = 4,
    InvalidProof = 5,
    InvalidCommitment = 6,
    GameNotFound = 7,
    NotYourTurn = 8,
    InvalidMove = 9,
    InvalidCard = 10,
}

// ---------------------------------------------------------------------------
// Data & Types
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Phase {
    Created,
    Commit,
    Reveal,
    Playing,
    Finished,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Card {
    pub suit: u32,   // 0-3: Swords, Coins, Cups, Wands
    pub rank: u32,   // 1-10
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GameState {
    pub session_id: u32,
    pub player1: Address,
    pub player2: Address,
    pub p1_deck_root: Bytes,
    pub p2_deck_root: Bytes,
    pub p1_commit: Option<Bytes>,
    pub p2_commit: Option<Bytes>,
    pub p1_revealed: bool,
    pub p2_revealed: bool,
    pub shared_seed: Bytes,
    pub p1_score: u32,
    pub p2_score: u32,
    pub p1_busts: u32,
    pub p2_busts: u32,
    pub p1_cards_drawn: u32,  // Cards drawn from deck
    pub p2_cards_drawn: u32,
    pub active_player: Address,
    pub turn_cards: Vec<u32>,      // Card IDs drawn this turn
    pub turn_suits_mask: u32,      // 4-bit mask of suits this turn
    pub turn_score: u32,          // Points accumulated this turn
    pub phase: Phase,
    pub turn_number: u32,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    GameState(u32),
    GameHub,
    Admin,
    Initialized,
}

const GAME_TTL_LEDGERS: u32 = 518_400; // ~30 days
const WIN_SCORE: u32 = 60;
const MAX_BUSTS: u32 = 3;
const DECK_SIZE: u32 = 40;

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

impl Card {
    pub fn from_id(card_id: u32) -> Result<Self, Error> {
        if card_id >= DECK_SIZE {
            return Err(Error::InvalidCard);
        }
        
        let suit = card_id / 10;
        let rank = (card_id % 10) + 1;
        
        Ok(Card { suit, rank })
    }
    
    pub fn to_id(&self) -> u32 {
        self.suit * 10 + (self.rank - 1)
    }
    
    pub fn value(&self) -> u32 {
        self.rank
    }
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct DeadMansDrawContract;

#[contractimpl]
impl DeadMansDrawContract {
    /// Initialize the contract with GameHub (constructor pattern).
    pub fn __constructor(env: Env, admin: Address, game_hub: Address) {
        if env.storage().instance().has(&DataKey::Initialized) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::GameHub, &game_hub);
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().extend_ttl(GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);
    }

    /// Start a new game session with deck commitments.
    pub fn start_game(
        env: Env,
        session_id: u32,
        player1: Address,
        player2: Address,
        p1_deck_root: Bytes,
        p2_deck_root: Bytes,
    ) {
        if !env.storage().instance().has(&DataKey::Initialized) {
            panic_with_error!(&env, Error::NotInitialized);
        }

        if player1 == player2 {
            panic_with_error!(&env, Error::InvalidMove);
        }

        player1.require_auth();
        player2.require_auth();

        let game_key = DataKey::GameState(session_id);
        if env.storage().temporary().has(&game_key) {
            panic_with_error!(&env, Error::InvalidMove);
        }

        env.events().publish(
            (symbol_short!("NEW_GAME"), session_id), 
            (player1.clone(), player2.clone())
        );

        let state = GameState {
            session_id,
            player1: player1.clone(),
            player2: player2.clone(),
            p1_deck_root,
            p2_deck_root,
            p1_commit: None,
            p2_commit: None,
            p1_revealed: false,
            p2_revealed: false,
            shared_seed: Bytes::new(&env),
            p1_score: 0,
            p2_score: 0,
            p1_busts: 0,
            p2_busts: 0,
            p1_cards_drawn: 0,
            p2_cards_drawn: 0,
            active_player: player1.clone(),
            turn_cards: Vec::new(&env),
            turn_suits_mask: 0,
            turn_score: 0,
            phase: Phase::Commit,
            turn_number: 1,
        };

        env.storage().temporary().set(&game_key, &state);
        env.storage().temporary().extend_ttl(&game_key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        let game_hub_addr: Address = env.storage().instance()
            .get(&DataKey::GameHub)
            .unwrap();
        let client = GameHubClient::new(&env, &game_hub_addr);
        
        client.start_game(
            &env.current_contract_address(),
            &session_id,
            &player1,
            &player2,
            &0i128,
            &0i128
        );
    }

    /// Phase 1: Commit seed hash
    pub fn commit(env: Env, session_id: u32, player: Address, hash: Bytes) {
        player.require_auth();
        
        let game_key = DataKey::GameState(session_id);
        let mut state: GameState = env.storage().temporary()
            .get(&game_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::GameNotFound));
        
        if state.phase != Phase::Commit {
            panic_with_error!(&env, Error::NotInPhase);
        }

        if player == state.player1 {
            state.p1_commit = Some(hash);
        } else if player == state.player2 {
            state.p2_commit = Some(hash);
        } else {
            panic_with_error!(&env, Error::NotPlayer);
        }

        if state.p1_commit.is_some() && state.p2_commit.is_some() {
            state.phase = Phase::Reveal;
            env.events().publish((symbol_short!("PHASE"), session_id), Phase::Reveal);
        }

        env.storage().temporary().set(&game_key, &state);
        env.storage().temporary().extend_ttl(&game_key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);
    }

    /// Phase 2: Reveal seed
    pub fn reveal(env: Env, session_id: u32, player: Address, seed: Bytes) {
        player.require_auth();
        
        let game_key = DataKey::GameState(session_id);
        let mut state: GameState = env.storage().temporary()
            .get(&game_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::GameNotFound));
        
        if state.phase != Phase::Reveal {
            panic_with_error!(&env, Error::NotInPhase);
        }

        let seed_hash: Bytes = env.crypto().sha256(&seed).into();
        
        if player == state.player1 {
            if state.p1_commit.is_none() {
                panic_with_error!(&env, Error::InvalidCommitment);
            }
            if seed_hash != state.p1_commit.clone().unwrap() {
                panic_with_error!(&env, Error::InvalidCommitment);
            }
            state.p1_revealed = true;
        } else if player == state.player2 {
            if state.p2_commit.is_none() {
                panic_with_error!(&env, Error::InvalidCommitment);
            }
            if seed_hash != state.p2_commit.clone().unwrap() {
                panic_with_error!(&env, Error::InvalidCommitment);
            }
            state.p2_revealed = true;
        } else {
            panic_with_error!(&env, Error::NotPlayer);
        }

        let mut current_seed = state.shared_seed;
        current_seed.append(&seed);
        state.shared_seed = current_seed;

        if state.p1_revealed && state.p2_revealed {
            // Determine starting player deterministically
            let final_hash = env.crypto().sha256(&state.shared_seed);
            let hash_bytes = final_hash.to_bytes();
            let last_byte = hash_bytes.get(31).unwrap_or(0);
            
            if last_byte % 2 == 0 {
                state.active_player = state.player1.clone();
            } else {
                state.active_player = state.player2.clone();
            }
            state.phase = Phase::Playing; 
            env.events().publish((symbol_short!("PHASE"), session_id), Phase::Playing);
        }
        
        env.storage().temporary().set(&game_key, &state);
        env.storage().temporary().extend_ttl(&game_key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);
    }

    /// Draw a card with ZK proof
    pub fn draw_card(
        env: Env,
        session_id: u32,
        card_id: u32,
        proof: Bytes,
        is_bust: bool,
        new_suits_mask: u32,
    ) {
        let game_key = DataKey::GameState(session_id);
        let mut state: GameState = env.storage().temporary()
            .get(&game_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::GameNotFound));
        
        state.active_player.require_auth();
        
        if state.phase != Phase::Playing {
            panic_with_error!(&env, Error::NotInPhase);
        }

        // Validate proof (stub - will integrate Protocol 25 verification)
        if proof.len() == 0 {
            panic_with_error!(&env, Error::InvalidProof);
        }

        // TODO: Verify ZK proof that:
        // 1. Card exists in player's deck
        // 2. Bust detection is correct
        // 3. New suits mask is correct

        let card = Card::from_id(card_id)
            .unwrap_or_else(|_| panic_with_error!(&env, Error::InvalidCard));

        // Update cards drawn counter
        if state.active_player == state.player1 {
            state.p1_cards_drawn += 1;
            if state.p1_cards_drawn > DECK_SIZE {
                panic_with_error!(&env, Error::InvalidMove);
            }
        } else {
            state.p2_cards_drawn += 1;
            if state.p2_cards_drawn > DECK_SIZE {
                panic_with_error!(&env, Error::InvalidMove);
            }
        }

        if is_bust {
            // BUST! Lose all cards this turn
            state.turn_cards = Vec::new(&env);
            state.turn_suits_mask = 0;
            state.turn_score = 0;
            
            if state.active_player == state.player1 {
                state.p1_busts += 1;
            } else {
                state.p2_busts += 1;
            }
            
            env.events().publish(
                (symbol_short!("BUST"), session_id),
                state.active_player.clone()
            );
            
            // Check if player has busted too many times
            let busts = if state.active_player == state.player1 {
                state.p1_busts
            } else {
                state.p2_busts
            };
            
            if busts >= MAX_BUSTS {
                Self::finalize_game(env.clone(), state.clone());
                return;
            }
            
            // End turn automatically on bust
            Self::switch_player(&mut state);
        } else {
            // Safe draw - add to turn
            state.turn_cards.push_back(card_id);
            state.turn_suits_mask = new_suits_mask;
            state.turn_score += card.value();
            
            env.events().publish(
                (symbol_short!("DRAW"), session_id),
                card_id as u32
            );
        }

        env.storage().temporary().set(&game_key, &state);
        env.storage().temporary().extend_ttl(&game_key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);
    }

    /// Bank cards (stop drawing and add to score)
    pub fn bank_cards(env: Env, session_id: u32) {
        let game_key = DataKey::GameState(session_id);
        let mut state: GameState = env.storage().temporary()
            .get(&game_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::GameNotFound));
        
        state.active_player.require_auth();
        
        if state.phase != Phase::Playing {
            panic_with_error!(&env, Error::NotInPhase);
        }

        // Add turn score to player's total
        if state.active_player == state.player1 {
            state.p1_score += state.turn_score;
        } else {
            state.p2_score += state.turn_score;
        }

        env.events().publish(
            (symbol_short!("BANK"), session_id),
            state.turn_score
        );

        // Clear turn state
        state.turn_cards = Vec::new(&env);
        state.turn_suits_mask = 0;
        state.turn_score = 0;

        // Check win condition
        if state.p1_score >= WIN_SCORE || state.p2_score >= WIN_SCORE {
            Self::finalize_game(env.clone(), state.clone());
            return;
        }

        // Switch to next player
        Self::switch_player(&mut state);

        env.storage().temporary().set(&game_key, &state);
        env.storage().temporary().extend_ttl(&game_key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);
    }

    /// Helper: Switch active player
    fn switch_player(state: &mut GameState) {
        if state.active_player == state.player1 {
            state.active_player = state.player2.clone();
        } else {
            state.active_player = state.player1.clone();
        }
        state.turn_number += 1;
    }

    /// Finalize game and notify Game Hub
    fn finalize_game(env: Env, mut state: GameState) {
        state.phase = Phase::Finished;
        
        let game_hub_addr: Address = env.storage().instance()
            .get(&DataKey::GameHub)
            .unwrap();
        let client = GameHubClient::new(&env, &game_hub_addr);
        
        // Determine winner
        let p1_won = if state.p1_score >= WIN_SCORE {
            true
        } else if state.p2_score >= WIN_SCORE {
            false
        } else if state.p2_busts >= MAX_BUSTS {
            true
        } else if state.p1_busts >= MAX_BUSTS {
            false
        } else {
            state.p1_score > state.p2_score
        };
        
        client.end_game(&state.session_id, &p1_won);
        
        env.events().publish(
            (symbol_short!("WINNER"), state.session_id),
            if p1_won { state.player1.clone() } else { state.player2.clone() }
        );
        
        let game_key = DataKey::GameState(state.session_id);
        env.storage().temporary().set(&game_key, &state);
        env.storage().temporary().extend_ttl(&game_key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);
    }
    
    /// Get current game state
    pub fn get_game(env: Env, session_id: u32) -> GameState {
        let game_key = DataKey::GameState(session_id);
        env.storage().temporary()
            .get(&game_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::GameNotFound))
    }
}

mod test;
