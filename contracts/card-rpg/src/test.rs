#![cfg(test)]

use crate::{CardAppContract, CardAppContractClient, Phase};
use soroban_sdk::{contract, contractimpl, Address, Bytes, Env, testutils::{Address as _, Ledger as _}};

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
    }

    pub fn end_game(_env: Env, _session_id: u32, _player1_won: bool) {
    }
}

fn setup_test() -> (Env, CardAppContractClient<'static>, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    
    // Set ledger info
    /*
    env.ledger().set(soroban_sdk::testutils::LedgerInfo {
        timestamp: 1441065600,
        protocol_version: 24,
        sequence_number: 100,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 1000,
        min_persistent_entry_ttl: 1000,
        max_entry_ttl: 1000000,
    });
    */

    let hub_id = env.register(MockGameHub, ());
    let admin = Address::generate(&env);
    
    let contract_id = env.register(CardAppContract, ());
    let client = CardAppContractClient::new(&env, &contract_id);
    client.init(&admin, &hub_id);
    
    let p1 = Address::generate(&env);
    let p2 = Address::generate(&env);
    
    (env, client, admin, p1, p2)
}


#[test]
fn test_game_flow() {
    // Basic test remains, but now handles updated phases.
    let (env, client, _admin, p1, p2) = setup_test();

    // Start Game - Now goes to Commit Phase
    client.start_game(&1, &p1, &p2, &100);
    let state = client.get_state();
    assert_eq!(state.phase, Phase::Commit);

    // Commit Seeds
    let seed1_raw = Bytes::from_slice(&env, &[1u8; 32]);
    let seed1_hash: Bytes = env.crypto().sha256(&seed1_raw).into();
    
    let seed2_raw = Bytes::from_slice(&env, &[2u8; 32]);
    let seed2_hash: Bytes = env.crypto().sha256(&seed2_raw).into();
    
    client.commit(&p1, &seed1_hash);
    client.commit(&p2, &seed2_hash);
    
    let state = client.get_state();
    assert_eq!(state.phase, Phase::Reveal);

    // Reveal Seeds
    // Now pass the raw bytes
    client.reveal(&p1, &seed1_raw);
    client.reveal(&p2, &seed2_raw);
    
    let state = client.get_state();
    assert_eq!(state.phase, Phase::Draw);
    // Active player determined by XOR seed (even/odd)
}

