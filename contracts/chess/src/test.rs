#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, BytesN as _, Ledger},
    vec, Address, BytesN, Env,
};

// Mock GameHub contract for testing
#[contract]
pub struct MockGameHub;

#[contractimpl]
impl MockGameHub {
    pub fn start_game(
        _env: Env,
        _game_id: Address,
        _session_id: u32,
        _player1: Address,
        _player2: Address,
        _player1_points: i128,
        _player2_points: i128,
    ) {
        // Mock implementation - just accept the call
    }

    pub fn end_game(_env: Env, _session_id: u32, _player1_won: bool) {
        // Mock implementation - just accept the call
    }
}

fn create_test_env() -> (Env, Address, Address, Address, Address, Address, VerificationKey) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(FogOfWarChessContract, ());
    let game_hub_id = env.register(MockGameHub, ());
    let admin = Address::generate(&env);
    let player1 = Address::generate(&env);
    let player2 = Address::generate(&env);

    // Create mock verification key
    let vk = VerificationKey {
        alpha: BytesN::from_array(&env, &[0u8; 64]),
        beta: BytesN::from_array(&env, &[0u8; 128]),
        gamma: BytesN::from_array(&env, &[0u8; 128]),
        delta: BytesN::from_array(&env, &[0u8; 128]),
        ic: vec![&env, BytesN::from_array(&env, &[0u8; 64])],
    };

    (env, contract_id, game_hub_id, admin, player1, player2, vk)
}

fn create_mock_proof(env: &Env) -> Groth16Proof {
    Groth16Proof {
        pi_a: BytesN::from_array(env, &[1u8; 64]),
        pi_b: BytesN::from_array(env, &[2u8; 128]),
        pi_c: BytesN::from_array(env, &[3u8; 64]),
    }
}

fn create_mock_move(
    env: &Env,
    from: u32,
    to: u32,
    board_commitment: BytesN<32>,
    move_hash: BytesN<32>,
) -> ChessMove {
    let mut public_inputs = vec![env];
    public_inputs.push_back(board_commitment);
    public_inputs.push_back(move_hash.clone());
    public_inputs.push_back(BytesN::from_array(env, &[0u8; 32])); // is_capture
    public_inputs.push_back(BytesN::from_array(env, &[0u8; 32])); // is_check

    ChessMove {
        from_square: from,
        to_square: to,
        move_hash,
        is_capture: false,
        is_check: false,
        is_checkmate: false,
        proof: ZKProof {
            proof: create_mock_proof(env),
            public_inputs,
        },
        timestamp: env.ledger().timestamp(),
    }
}

#[test]
fn test_start_game_success() {
    let (env, contract_id, game_hub_id, admin, player1, player2, vk) = create_test_env();
    let client = FogOfWarChessContractClient::new(&env, &contract_id);

    // Initialize contract
    FogOfWarChessContract::__constructor(env.clone(), admin.clone(), game_hub_id.clone(), vk.clone());

    let session_id = 1u32;
    let white_commitment = BytesN::random(&env);
    let black_commitment = BytesN::random(&env);

    client.start_game(
        &session_id,
        &player1,
        &player2,
        &1000,
        &1000,
        &white_commitment,
        &black_commitment,
    );

    // Verify game was created
    let game = client.get_game(&session_id);
    assert_eq!(game.player1, player1);
    assert_eq!(game.player2, player2);
    assert_eq!(game.current_turn, 0);
    assert_eq!(game.move_count, 0);
    assert!(!game.game_over);
}

#[test]
#[should_panic(expected = "Cannot play against yourself")]
fn test_start_game_self_play() {
    let (env, contract_id, game_hub_id, admin, player1, _, vk) = create_test_env();
    let client = FogOfWarChessContractClient::new(&env, &contract_id);

    FogOfWarChessContract::__constructor(env.clone(), admin.clone(), game_hub_id.clone(), vk.clone());

    let white_commitment = BytesN::random(&env);
    let black_commitment = BytesN::random(&env);

    // Try to start game with same player
    client.start_game(
        &1,
        &player1,
        &player1, // Same as player1
        &1000,
        &1000,
        &white_commitment,
        &black_commitment,
    );
}

#[test]
fn test_make_move_success() {
    let (env, contract_id, game_hub_id, admin, player1, player2, vk) = create_test_env();
    let client = FogOfWarChessContractClient::new(&env, &contract_id);

    FogOfWarChessContract::__constructor(env.clone(), admin.clone(), game_hub_id.clone(), vk.clone());

    let session_id = 1u32;
    let white_commitment = BytesN::random(&env);
    let black_commitment = BytesN::random(&env);

    client.start_game(
        &session_id,
        &player1,
        &player2,
        &1000,
        &1000,
        &white_commitment,
        &black_commitment,
    );

    // White makes first move (e2 to e4)
    let move_hash = BytesN::random(&env);
    let chess_move = create_mock_move(&env, 12, 28, white_commitment.clone(), move_hash);
    let new_commitment = BytesN::random(&env);

    client.make_move(&session_id, &player1, &chess_move, &new_commitment);

    // Verify move was recorded
    let game = client.get_game(&session_id);
    assert_eq!(game.move_count, 1);
    assert_eq!(game.current_turn, 1); // Now black's turn
    assert_eq!(game.white_board_commitment, new_commitment);

    // Verify move can be retrieved
    let stored_move = client.get_move(&session_id, &0);
    assert_eq!(stored_move.from_square, 12);
    assert_eq!(stored_move.to_square, 28);
}

#[test]
fn test_resign() {
    let (env, contract_id, game_hub_id, admin, player1, player2, vk) = create_test_env();
    let client = FogOfWarChessContractClient::new(&env, &contract_id);

    FogOfWarChessContract::__constructor(env.clone(), admin.clone(), game_hub_id.clone(), vk.clone());

    let session_id = 1u32;
    let white_commitment = BytesN::random(&env);
    let black_commitment = BytesN::random(&env);

    client.start_game(
        &session_id,
        &player1,
        &player2,
        &1000,
        &1000,
        &white_commitment,
        &black_commitment,
    );

    // Player1 resigns
    let winner = client.resign(&session_id, &player1);
    assert_eq!(winner, player2);

    // Verify game ended
    let game = client.get_game(&session_id);
    assert!(game.game_over);
    assert_eq!(game.winner, Some(player2));
}

#[test]
fn test_draw_offer_and_accept() {
    let (env, contract_id, game_hub_id, admin, player1, player2, vk) = create_test_env();
    let client = FogOfWarChessContractClient::new(&env, &contract_id);

    FogOfWarChessContract::__constructor(env.clone(), admin.clone(), game_hub_id.clone(), vk.clone());

    let session_id = 1u32;
    let white_commitment = BytesN::random(&env);
    let black_commitment = BytesN::random(&env);

    client.start_game(
        &session_id,
        &player1,
        &player2,
        &1000,
        &1000,
        &white_commitment,
        &black_commitment,
    );

    // Player1 offers draw
    client.offer_draw(&session_id, &player1);

    let game = client.get_game(&session_id);
    assert_eq!(game.draw_offered_by, Some(player1.clone()));

    // Player2 accepts draw
    client.accept_draw(&session_id, &player2);

    let game = client.get_game(&session_id);
    assert!(game.game_over);
    assert_eq!(game.winner, None); // Draw has no winner
}
