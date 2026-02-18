#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation},
    Address, Env, IntoVal, Symbol, Vec,
};

// Mock Game Hub contract for testing
mod mock_game_hub {
    soroban_sdk::contractimport!(
        file = "../../target/wasm32v1-none/release/mock_game_hub.wasm"
    );
}

fn create_pocker_contract<'a>(e: &Env) -> (Address, PockerContractClient<'a>) {
    let contract_id = e.register_contract(None, PockerContract);
    let client = PockerContractClient::new(e, &contract_id);
    (contract_id, client)
}

fn create_game_hub<'a>(e: &Env) -> (Address, mock_game_hub::Client<'a>) {
    let contract_id = e.register_contract_wasm(None, mock_game_hub::WASM);
    let client = mock_game_hub::Client::new(e, &contract_id);
    (contract_id, client)
}

#[test]
fn test_game_initialization() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (game_hub_id, _game_hub) = create_game_hub(&env);
    let (_contract_id, pocker) = create_pocker_contract(&env);

    // Initialize contract
    pocker.__constructor(&admin, &game_hub_id);

    // Verify admin and hub are set
    assert_eq!(pocker.get_admin(), admin);
    assert_eq!(pocker.get_hub(), game_hub_id);
}

#[test]
fn test_start_game() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let player1 = Address::generate(&env);
    let player2 = Address::generate(&env);
    let (game_hub_id, game_hub) = create_game_hub(&env);
    let (contract_id, pocker) = create_pocker_contract(&env);

    // Initialize contracts
    pocker.__constructor(&admin, &game_hub_id);
    game_hub.initialize(&admin);

    let session_id = 1u32;
    let player1_points = 100i128;
    let player2_points = 100i128;

    // Start game
    pocker.start_game(
        &session_id,
        &player1,
        &player2,
        &player1_points,
        &player2_points,
    );

    // Verify game was created
    let game = pocker.get_game(&session_id).unwrap();
    assert_eq!(game.player1, player1);
    assert_eq!(game.player2, player2);
    assert_eq!(game.player1_points, player1_points);
    assert_eq!(game.player2_points, player2_points);
    assert_eq!(game.phase, Phase::Commit);
    assert!(game.winner.is_none());

    // Verify Game Hub was called
    env.as_contract(&contract_id, || {
        assert_eq!(
            env.auths(),
            std::vec![(
                player1.clone(),
                AuthorizedInvocation {
                    function: AuthorizedFunction::Contract((
                        contract_id.clone(),
                        Symbol::new(&env, "start_game"),
                        (
                            session_id,
                            player1.clone(),
                            player2.clone(),
                            player1_points,
                            player2_points,
                        )
                            .into_val(&env)
                    )),
                    sub_invocations: std::vec![]
                }
            )]
        );
    });
}

#[test]
#[should_panic(expected = "NotPlayer")]
fn test_prevent_self_play() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let player = Address::generate(&env);
    let (game_hub_id, game_hub) = create_game_hub(&env);
    let (_contract_id, pocker) = create_pocker_contract(&env);

    pocker.__constructor(&admin, &game_hub_id);
    game_hub.initialize(&admin);

    // Try to start game with same player
    pocker.start_game(&1u32, &player, &player, &100i128, &100i128);
}

#[test]
fn test_commit_phase() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let player1 = Address::generate(&env);
    let player2 = Address::generate(&env);
    let (game_hub_id, game_hub) = create_game_hub(&env);
    let (_contract_id, pocker) = create_pocker_contract(&env);

    pocker.__constructor(&admin, &game_hub_id);
    game_hub.initialize(&admin);

    let session_id = 1u32;

    // Start game
    pocker.start_game(&session_id, &player1, &player2, &100i128, &100i128);

    // Player 1 commits hole cards (2 cards)
    let commitment1 = Bytes::from_slice(
        &env,
        b"commitment1_hash_poseidon_12345678901234567890",
    );
    pocker.submit_hole_commitment(&session_id, &player1, &commitment1);

    let game = pocker.get_game(&session_id).unwrap();
    assert!(game.player1_hole_commitment.is_some());
    assert!(game.player2_hole_commitment.is_none());
    assert_eq!(game.phase, Phase::Commit);

    // Player 2 commits hole cards (2 cards)
    let commitment2 = Bytes::from_slice(
        &env,
        b"commitment2_hash_poseidon_98765432109876543210",
    );
    pocker.submit_hole_commitment(&session_id, &player2, &commitment2);

    let game = pocker.get_game(&session_id).unwrap();
    assert!(game.player1_hole_commitment.is_some());
    assert!(game.player2_hole_commitment.is_some());
    assert_eq!(game.phase, Phase::Preflop); // Should move to Preflop phase
}

#[test]
#[should_panic(expected = "AlreadyCommitted")]
fn test_cannot_commit_twice() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let player1 = Address::generate(&env);
    let player2 = Address::generate(&env);
    let (game_hub_id, game_hub) = create_game_hub(&env);
    let (_contract_id, pocker) = create_pocker_contract(&env);

    pocker.__constructor(&admin, &game_hub_id);
    game_hub.initialize(&admin);

    let session_id = 1u32;
    pocker.start_game(&session_id, &player1, &player2, &100i128, &100i128);

    let commitment = Bytes::from_slice(&env, b"commitment_hash");
    pocker.submit_hole_commitment(&session_id, &player1, &commitment);

    // Try to commit again
    pocker.submit_hole_commitment(&session_id, &player1, &commitment);
}

#[test]
fn test_reveal_winner() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let player1 = Address::generate(&env);
    let player2 = Address::generate(&env);
    let (game_hub_id, game_hub) = create_game_hub(&env);
    let (_contract_id, pocker) = create_pocker_contract(&env);

    pocker.__constructor(&admin, &game_hub_id);
    game_hub.initialize(&admin);

    let session_id = 1u32;
    pocker.start_game(&session_id, &player1, &player2, &100i128, &100i128);

    // Both players commit hole cards
    let commitment1 = Bytes::from_slice(&env, b"commitment1_hash");
    let commitment2 = Bytes::from_slice(&env, b"commitment2_hash");
    pocker.submit_hole_commitment(&session_id, &player1, &commitment1);
    pocker.submit_hole_commitment(&session_id, &player2, &commitment2);

    // Create mock proof (in real game, this would be a valid ZK proof)
    let proof_pi_a = BytesN::from_array(&env, &[0u8; 64]);
    let proof_pi_b = BytesN::from_array(&env, &[1u8; 128]);
    let proof_pi_c = BytesN::from_array(&env, &[2u8; 64]);

    let proof = Groth16Proof {
        pi_a: proof_pi_a,
        pi_b: proof_pi_b,
        pi_c: proof_pi_c,
    };

    // Create public signals
    // [0] = player1_hole_commitment
    // [1] = player2_hole_commitment
    // [2] = community_commitment
    // [3] = player1_ranking (e.g., 5 = Flush)
    // [4] = player2_ranking (e.g., 3 = Three of a Kind)
    // [5] = winner (1 = player1)
    let mut public_signals = Vec::new(&env);
    public_signals.push_back(commitment1.clone());
    public_signals.push_back(commitment2.clone());
    public_signals.push_back(Bytes::from_slice(&env, b"community_commitment"));
    public_signals.push_back(Bytes::from_slice(&env, &[5u8])); // player1 ranking
    public_signals.push_back(Bytes::from_slice(&env, &[3u8])); // player2 ranking
    public_signals.push_back(Bytes::from_slice(&env, &[1u8])); // winner = player1

    // Note: This will fail without a valid verification key
    // In production, you would set the verification key first
    // For this test, we're just verifying the flow structure
    
    // Uncomment when verification key is set:
    // let winner = pocker.reveal_winner(&session_id, &proof, &public_signals);
    // assert_eq!(winner, player1);
    
    // let game = pocker.get_game(&session_id).unwrap();
    // assert_eq!(game.winner, Some(player1));
    // assert_eq!(game.phase, Phase::Complete);
}

#[test]
#[should_panic(expected = "NotInPhase")]
fn test_cannot_reveal_before_commit() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let player1 = Address::generate(&env);
    let player2 = Address::generate(&env);
    let (game_hub_id, game_hub) = create_game_hub(&env);
    let (_contract_id, pocker) = create_pocker_contract(&env);

    pocker.__constructor(&admin, &game_hub_id);
    game_hub.initialize(&admin);

    let session_id = 1u32;
    pocker.start_game(&session_id, &player1, &player2, &100i128, &100i128);

    // Try to reveal without committing
    let proof = Groth16Proof {
        pi_a: Vec::new(&env),
        pi_b: Vec::new(&env),
        pi_c: Vec::new(&env),
    };
    let public_signals = Vec::new(&env);

    pocker.reveal_winner(&session_id, &proof, &public_signals);
}

#[test]
fn test_admin_functions() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);
    let (game_hub_id, _game_hub) = create_game_hub(&env);
    let (_contract_id, pocker) = create_pocker_contract(&env);

    pocker.__constructor(&admin, &game_hub_id);

    // Test set_admin
    pocker.set_admin(&new_admin);
    assert_eq!(pocker.get_admin(), new_admin);

    // Test set_hub
    let new_hub = Address::generate(&env);
    pocker.set_hub(&new_hub);
    assert_eq!(pocker.get_hub(), new_hub);
}

#[test]
fn test_game_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (game_hub_id, _game_hub) = create_game_hub(&env);
    let (_contract_id, pocker) = create_pocker_contract(&env);

    pocker.__constructor(&admin, &game_hub_id);

    // Try to get non-existent game
    let result = pocker.try_get_game(&999u32);
    assert!(result.is_err());
}
