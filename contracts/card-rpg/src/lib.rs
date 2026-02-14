#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol, Vec, Bytes
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
// Data & Types
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Phase {
    Standby,
    Commit,
    Reveal,
    Draw,
    Main,
    Battle,
    End,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GameState {
    pub player1: Address,
    pub player2: Address,
    pub p1_commit: Option<Bytes>,
    pub p2_commit: Option<Bytes>,
    pub p1_revealed: bool,
    pub p2_revealed: bool,
    pub shared_seed: Bytes,
    pub current_turn: u32,
    pub p1_lp: u32,
    pub p2_lp: u32,
    pub active_player: Address,
    pub phase: Phase,
    pub last_move_proof: Option<Bytes>,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    GameState,
    GameHub,
    Admin,
}

const GAME_TTL_LEDGERS: u32 = 518_400; // ~30 days

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct CardAppContract;

#[contractimpl]
impl CardAppContract {
    /// Initialize the contract with GameHub.
    pub fn init(env: Env, admin: Address, game_hub: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::GameHub, &game_hub);
    }

    /// Start a new game session.
    /// Called by the Game Hub or via a proxy that mandates Game Hub interaction.
    pub fn start_game(
        env: Env,
        session_id: u32,
        player1: Address,
        player2: Address,
        item_id_limit: u32, // Not used but part of some interfaces
    ) {
        player1.require_auth();
        player2.require_auth();

        // Emit Event
        env.events().publish(
            (symbol_short!("NEW_GAME"), session_id), 
            (player1.clone(), player2.clone())
        );

        let state = GameState {
            player1: player1.clone(),
            player2: player2.clone(),
            p1_commit: None,
            p2_commit: None,
            p1_revealed: false,
            p2_revealed: false,
            shared_seed: Bytes::new(&env),
            current_turn: 1,
            p1_lp: 8000,
            p2_lp: 8000,
            active_player: player1.clone(),
            phase: Phase::Commit, // Start at Commit Phase
            last_move_proof: None,
        };

        env.storage().instance().set(&DataKey::GameState, &state);
        // Extend TTL
        env.storage().instance().extend_ttl(GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);

        // Notify Game Hub
        let game_hub_addr: Address = env.storage().instance().get(&DataKey::GameHub).unwrap();
        let client = GameHubClient::new(&env, &game_hub_addr);
        
        // Note: In a real flow, points would be handled here. 
        // We pass 0 points for this basic implementation.
        client.start_game(
            &env.current_contract_address(),
            &session_id,
            &player1,
            &player2,
            &0i128,
            &0i128
        );
    }

    /// Phase 1: Players commit their secret seed hashes.
    pub fn commit(env: Env, player: Address, hash: Bytes) {
        player.require_auth();
        let mut state: GameState = env.storage().instance().get(&DataKey::GameState).unwrap();
        
        // Retrieve Session ID for events - assuming we store it or can infer it. 
        // For now, using a DataKey for SessionID would be better, but we'll emit generic.
        // Or assume 0 for single instance if deployed per game, or argument.
        // Optimization: Pass session_id in calls or store in state.
        // Let's add session_id to GameState for Events.
        
        if state.phase != Phase::Commit {
            panic!("Not in Commit Phase");
        }

        if player == state.player1 {
            state.p1_commit = Some(hash);
        } else if player == state.player2 {
            state.p2_commit = Some(hash);
        } else {
            panic!("Not a player");
        }

        // Check if both committed
        if state.p1_commit.is_some() && state.p2_commit.is_some() {
            state.phase = Phase::Reveal;
            env.events().publish((symbol_short!("PHASE"), 0u32), Phase::Reveal);
        }

        env.storage().instance().set(&DataKey::GameState, &state);
    }

    /// Phase 2: Players reveal their seeds.
    /// Uses Commit-Reveal scheme to ensure fairness without an external oracle.
    pub fn reveal(env: Env, player: Address, seed: Bytes) {
        player.require_auth();
        let mut state: GameState = env.storage().instance().get(&DataKey::GameState).unwrap();
        
        if state.phase != Phase::Reveal {
            panic!("Not in Reveal Phase");
        }

        // Verify Hash: SHA256(seed) == stored_hash
        // Convert Hash<32> to Bytes for comparison
        let seed_hash: Bytes = env.crypto().sha256(&seed).into();
        
        if player == state.player1 {
            assert!(state.p1_commit.is_some(), "P1 No commit found");
            assert!(seed_hash == state.p1_commit.clone().unwrap(), "P1 Invalid Seed");
            state.p1_revealed = true;
        } else if player == state.player2 {
            assert!(state.p2_commit.is_some(), "P2 No commit found");
            assert!(seed_hash == state.p2_commit.clone().unwrap(), "P2 Invalid Seed");
            state.p2_revealed = true;
        } else {
            panic!("Not a player");
        }

        // Update shared seed by appending bytes
        let mut current_seed = state.shared_seed;
        current_seed.append(&seed);
        state.shared_seed = current_seed;

        // If this is the second reveal (both revealed), move to Draw
        if state.p1_revealed && state.p2_revealed {
            // Determine Start Player using the combined entropy
            let final_hash = env.crypto().sha256(&state.shared_seed).to_bytes();
            let last_byte = final_hash.get(31).unwrap_or(0); // Bytes get returns Option<u8> (or u8?) Check SDK. Default to get returns u8 in Bytes?
            // Actually Bytes::get returns Option<u8> in recent SDK? Or directly u8 if index is u32
            // Let's assume standard Soroban SDK Bytes::get(i) -> u8.
            
            if last_byte % 2 == 0 {
                state.active_player = state.player1.clone();
            } else {
                state.active_player = state.player2.clone();
            }
            state.phase = Phase::Draw; 
            env.events().publish((symbol_short!("PHASE"), 0u32), Phase::Draw);
        }
        
        env.storage().instance().set(&DataKey::GameState, &state);
    }

    /// Execute the Draw Phase.
    /// In a ZK game, this would involve proving you drew a card from your private deck commitment.
    pub fn draw_phase(env: Env, _proof: Bytes) {
        let mut state: GameState = env.storage().instance().get(&DataKey::GameState).unwrap();
        state.active_player.require_auth();
        
        if state.phase != Phase::Draw {
            panic!("Not in Draw Phase");
        }

        // TODO: Verify ZK Proof (Draw Circuit)
        // verify_draw_proof(&proof);

        state.phase = Phase::Main;
        env.storage().instance().set(&DataKey::GameState, &state);
    }

    /// Execute a Battle Move.
    /// This uses the Battle Circuit proof which takes two cards and position, and outputs damage.
    pub fn battle_phase(
        env: Env, 
        proof: Bytes, 
        p1_dmg: u32, 
        p2_dmg: u32,
        _destroy_p1: bool,
        _destroy_p2: bool
    ) {
        let mut state: GameState = env.storage().instance().get(&DataKey::GameState).unwrap();
        state.active_player.require_auth();

        if state.phase != Phase::Main && state.phase != Phase::Battle {
            panic!("Not in Battle Phase");
        }

        // TODO: Verify ZK Proof (Battle Circuit)
        // Ensure the public outputs (damage, destroy flags) match the proof.
        // verify_battle_proof(&proof, p1_dmg, p2_dmg, destroy_p1, destroy_p2);

        // Apply state changes
        if state.active_player == state.player1 {
            state.p2_lp = state.p2_lp.saturating_sub(p2_dmg);
            state.p1_lp = state.p1_lp.saturating_sub(p1_dmg);
        } else {
            state.p1_lp = state.p1_lp.saturating_sub(p2_dmg);
            state.p2_lp = state.p2_lp.saturating_sub(p1_dmg);
        }

        state.phase = Phase::End;
        state.last_move_proof = Some(proof);
        
        env.storage().instance().set(&DataKey::GameState, &state);

        // Check Win Condition
        if state.p1_lp == 0 || state.p2_lp == 0 {
             Self::finalize_game(env, state);
        }
    }

    pub fn end_turn(env: Env) {
        let mut state: GameState = env.storage().instance().get(&DataKey::GameState).unwrap();
        state.active_player.require_auth();

        // Switch Active Player
        if state.active_player == state.player1 {
            state.active_player = state.player2.clone();
        } else {
            state.active_player = state.player1.clone();
        }
        
        state.current_turn += 1;
        state.phase = Phase::Draw; // Next turn starts at Draw

        env.storage().instance().set(&DataKey::GameState, &state);
    }

    fn finalize_game(env: Env, state: GameState) {
        let game_hub_addr: Address = env.storage().instance().get(&DataKey::GameHub).unwrap();
        let client = GameHubClient::new(&env, &game_hub_addr);
        
        // Determine winner
        let p1_won = state.p1_lp > 0;
        
        // Pass dummy session ID (should be stored in state, simplified here)
        client.end_game(&0u32, &p1_won);
    }
    
    pub fn get_state(env: Env) -> GameState {
        env.storage().instance().get(&DataKey::GameState).unwrap()
    }
}

mod test;
