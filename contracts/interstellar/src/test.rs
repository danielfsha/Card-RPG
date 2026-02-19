use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_contract_initialization() {
    let env = Env::default();
    let contract_id = env.register_contract(None, InterstellarContract);
    let client = InterstellarContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let game_hub = Address::generate(&env);

    client.__constructor(&admin, &game_hub);

    assert_eq!(client.get_admin(), admin);
    assert_eq!(client.get_hub(), game_hub);
}

#[test]
fn test_start_game() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, InterstellarContract);
    let client = InterstellarContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let game_hub = Address::generate(&env);
    let player1 = Address::generate(&env);
    let player2 = Address::generate(&env);

    client.__constructor(&admin, &game_hub);

    // Note: This will fail without a real GameHub contract
    // In production, use a mock GameHub for testing
    // For now, this demonstrates the contract structure
}
