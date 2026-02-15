#![cfg(test)]

use crate::{DeadMansDrawContract, DeadMansDrawContractClient, Phase, Card};
use soroban_sdk::{
    contract, contractimpl, Address, Bytes, Env,
    testutils::{Address as _, Ledger as _}
};

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

fn setup_test() -> (Env, DeadMansDrawContractClient<'static>, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let hub_id = env.register(MockGameHub, ());
    let admin = Address::generate(&env);
    
    let contract_id = env.register(DeadMansDrawContract, (&admin, &hub_id));
    let client = DeadMansDrawContractClient::new(&env, &contract_id);
    
    let p1 = Address::generate(&env);
    let p2 = Address::generate(&env);
    
    (env, client, admin, p1, p2)
}

#[test]
fn test_card_encoding() {
    // Test Card struct encoding/decoding
    
    // Card 0: Swords 1
    let card = Card::from_id(0).unwrap();
    assert_eq!(card.suit, 0);
    assert_eq!(card.rank, 1);
    assert_eq!(card.to_id(), 0);
    assert_eq!(card.value(), 1);
    
    // Card 9: Swords 10
    let card = Card::from_id(9).unwrap();
    assert_eq!(card.suit, 0);
    assert_eq!(card.rank, 10);
    assert_eq!(card.to_id(), 9);
    assert_eq!(card.value(), 10);
    
    // Card 10: Coins 1
    let card = Card::from_id(10).unwrap();
    assert_eq!(card.suit, 1);
    assert_eq!(card.rank, 1);
    assert_eq!(card.to_id(), 10);
    
    // Card 25: Cups 6
    let card = Card::from_id(25).unwrap();
    assert_eq!(card.suit, 2);
    assert_eq!(card.rank, 6);
    assert_eq!(card.to_id(), 25);
    
    // Card 39: Wands 10
    let card = Card::from_id(39).unwrap();
    assert_eq!(card.suit, 3);
    assert_eq!(card.rank, 10);
    assert_eq!(card.to_id(), 39);
    assert_eq!(card.value(), 10);
}

#[test]
fn test_game_initialization() {
    let (env, client, _admin, p1, p2) = setup_test();

    let session_id = 12345u32;
    let p1_deck_root = Bytes::from_slice(&env, &[1u8; 32]);
    let p2_deck_root = Bytes::from_slice(&env, &[2u8; 32]);

    client.start_game(&session_id, &p1, &p2, &p1_deck_root, &p2_deck_root);
    
    let state = client.get_game(&session_id);
    assert_eq!(state.phase, Phase::Commit);
    assert_eq!(state.session_id, session_id);
    assert_eq!(state.p1_score, 0);
    assert_eq!(state.p2_score, 0);
    assert_eq!(state.p1_busts, 0);
    assert_eq!(state.p2_busts, 0);
}

#[test]
fn test_commit_reveal_flow() {
    let (env, client, _admin, p1, p2) = setup_test();

    let session_id = 12345u32;
    let p1_deck_root = Bytes::from_slice(&env, &[1u8; 32]);
    let p2_deck_root = Bytes::from_slice(&env, &[2u8; 32]);

    client.start_game(&session_id, &p1, &p2, &p1_deck_root, &p2_deck_root);
    
    // Commit seeds
    let seed1_raw = Bytes::from_slice(&env, &[1u8; 32]);
    let seed1_hash: Bytes = env.crypto().sha256(&seed1_raw).into();
    
    let seed2_raw = Bytes::from_slice(&env, &[2u8; 32]);
    let seed2_hash: Bytes = env.crypto().sha256(&seed2_raw).into();
    
    client.commit(&session_id, &p1, &seed1_hash);
    client.commit(&session_id, &p2, &seed2_hash);
    
    let state = client.get_game(&session_id);
    assert_eq!(state.phase, Phase::Reveal);

    // Reveal seeds
    client.reveal(&session_id, &p1, &seed1_raw);
    client.reveal(&session_id, &p2, &seed2_raw);
    
    let state = client.get_game(&session_id);
    assert_eq!(state.phase, Phase::Playing);
    assert!(state.p1_revealed);
    assert!(state.p2_revealed);
}

#[test]
fn test_draw_and_bank() {
    let (env, client, _admin, p1, p2) = setup_test();

    let session_id = 12345u32;
    let p1_deck_root = Bytes::from_slice(&env, &[1u8; 32]);
    let p2_deck_root = Bytes::from_slice(&env, &[2u8; 32]);

    // Setup to Playing phase
    client.start_game(&session_id, &p1, &p2, &p1_deck_root, &p2_deck_root);
    
    let seed1_raw = Bytes::from_slice(&env, &[1u8; 32]);
    let seed1_hash: Bytes = env.crypto().sha256(&seed1_raw).into();
    let seed2_raw = Bytes::from_slice(&env, &[2u8; 32]);
    let seed2_hash: Bytes = env.crypto().sha256(&seed2_raw).into();
    
    client.commit(&session_id, &p1, &seed1_hash);
    client.commit(&session_id, &p2, &seed2_hash);
    client.reveal(&session_id, &p1, &seed1_raw);
    client.reveal(&session_id, &p2, &seed2_raw);
    
    // Draw card 5 (Swords 6, value=6)
    let mock_proof = Bytes::from_slice(&env, &[0xAB; 64]);
    let card_id = 5u32;  // Swords 6
    let is_bust = false;
    let new_suits_mask = 0b0001u32;  // Swords bit set
    
    client.draw_card(&session_id, &card_id, &mock_proof, &is_bust, &new_suits_mask);
    
    let state = client.get_game(&session_id);
    assert_eq!(state.turn_score, 6);
    assert_eq!(state.turn_suits_mask, 0b0001);
    
    // Draw card 18 (Coins 9, value=9)
    let card_id2 = 18u32;  // Coins 9
    let new_suits_mask2 = 0b0011u32;  // Swords + Coins
    
    client.draw_card(&session_id, &card_id2, &mock_proof, &is_bust, &new_suits_mask2);
    
    let state = client.get_game(&session_id);
    assert_eq!(state.turn_score, 15);  // 6 + 9
    assert_eq!(state.turn_suits_mask, 0b0011);
    
    // Bank cards
    client.bank_cards(&session_id);
    
    let state = client.get_game(&session_id);
    let active_was_p1 = state.active_player == p2;  // Switched
    
    if active_was_p1 {
        assert_eq!(state.p1_score, 15);
        assert_eq!(state.p2_score, 0);
    } else {
        assert_eq!(state.p1_score, 0);
        assert_eq!(state.p2_score, 15);
    }
    
    assert_eq!(state.turn_score, 0);
    assert_eq!(state.turn_suits_mask, 0);
}

#[test]
fn test_bust_detection() {
    let (env, client, _admin, p1, p2) = setup_test();

    let session_id = 12345u32;
    let p1_deck_root = Bytes::from_slice(&env, &[1u8; 32]);
    let p2_deck_root = Bytes::from_slice(&env, &[2u8; 32]);

    // Setup to Playing phase
    client.start_game(&session_id, &p1, &p2, &p1_deck_root, &p2_deck_root);
    
    let seed1_raw = Bytes::from_slice(&env, &[1u8; 32]);
    let seed1_hash: Bytes = env.crypto().sha256(&seed1_raw).into();
    let seed2_raw = Bytes::from_slice(&env, &[2u8; 32]);
    let seed2_hash: Bytes = env.crypto().sha256(&seed2_raw).into();
    
    client.commit(&session_id, &p1, &seed1_hash);
    client.commit(&session_id, &p2, &seed2_hash);
    client.reveal(&session_id, &p1, &seed1_raw);
    client.reveal(&session_id, &p2, &seed2_raw);
    
    let mock_proof = Bytes::from_slice(&env, &[0xAB; 64]);
    
    // Draw card 5 (Swords 6)
    client.draw_card(&session_id, &5u32, &mock_proof, &false, &0b0001u32);
    
    let state = client.get_game(&session_id);
    let initial_player = state.active_player.clone();
    assert_eq!(state.turn_score, 6);
    
    // Draw card 7 (Swords 8) - BUST! (duplicate suit)
    client.draw_card(&session_id, &7u32, &mock_proof, &true, &0b0001u32);
    
    let state = client.get_game(&session_id);
    
    // Turn should be cleared and player switched
    assert_eq!(state.turn_score, 0);
    assert_eq!(state.turn_suits_mask, 0);
    assert!(state.active_player != initial_player);
    
    // Bust counter incremented
    if initial_player == p1 {
        assert_eq!(state.p1_busts, 1);
        assert_eq!(state.p2_busts, 0);
    } else {
        assert_eq!(state.p1_busts, 0);
        assert_eq!(state.p2_busts, 1);
    }
}

#[test]
fn test_win_by_score() {
    let (env, client, _admin, p1, p2) = setup_test();

    let session_id = 12345u32;
    let p1_deck_root = Bytes::from_slice(&env, &[1u8; 32]);
    let p2_deck_root = Bytes::from_slice(&env, &[2u8; 32]);

    // Setup to Playing phase
    client.start_game(&session_id, &p1, &p2, &p1_deck_root, &p2_deck_root);
    
    let seed1_raw = Bytes::from_slice(&env, &[1u8; 32]);
    let seed1_hash: Bytes = env.crypto().sha256(&seed1_raw).into();
    let seed2_raw = Bytes::from_slice(&env, &[2u8; 32]);
    let seed2_hash: Bytes = env.crypto().sha256(&seed2_raw).into();
    
    client.commit(&session_id, &p1, &seed1_hash);
    client.commit(&session_id, &p2, &seed2_hash);
    client.reveal(&session_id, &p1, &seed1_raw);
    client.reveal(&session_id, &p2, &seed2_raw);
    
    let mock_proof = Bytes::from_slice(&env, &[0xAB; 64]);
    
    // Draw exactly 60 points worth of cards
    // Card 9 = Swords rank 10 = 10 points
    // Card 19 = Coins rank 10 = 10 points  
    // Card 29 = Cups rank 10 = 10 points
    // Card 39 = Wands rank 10 = 10 points
    // Card 8 = Swords rank 9 = 9 points
    // Card 18 = Coins rank 9 = 9 points
    // Card 1 = Swords rank 2 = 2 points
    // Total = 10+10+10+10+9+9+2 = 60 points
    let cards_to_draw = [9u32, 19u32, 29u32, 39u32, 8u32, 18u32, 1u32];
    
    for (i, card_id) in cards_to_draw.iter().enumerate() {
        let mask = 1u32 << (i % 4);  // Different suits
        client.draw_card(&session_id, card_id, &mock_proof, &false, &mask);
    }
    
    let state = client.get_game(&session_id);
    assert_eq!(state.turn_score, 60);
    
    // Bank to trigger win
    client.bank_cards(&session_id);
    
    let state = client.get_game(&session_id);
    assert_eq!(state.phase, Phase::Finished);
}

#[test]
fn test_prevent_self_play() {
    let (env, client, _admin, p1, _p2) = setup_test();

    let session_id = 12345u32;
    let p1_deck_root = Bytes::from_slice(&env, &[1u8; 32]);
    let p2_deck_root = Bytes::from_slice(&env, &[2u8; 32]);

    // Try to start game with same player - should fail with Error::InvalidMove (code 9)
    let result = client.try_start_game(&session_id, &p1, &p1, &p1_deck_root, &p2_deck_root);
    assert!(result.is_err());
}

#[test]
fn test_phase_validation() {
    let (env, client, _admin, p1, p2) = setup_test();

    let session_id = 12345u32;
    let p1_deck_root = Bytes::from_slice(&env, &[1u8; 32]);
    let p2_deck_root = Bytes::from_slice(&env, &[2u8; 32]);

    client.start_game(&session_id, &p1, &p2, &p1_deck_root, &p2_deck_root);
    
    // Try to draw before commit/reveal - should fail with Error::NotInPhase (code 3)
    let mock_proof = Bytes::from_slice(&env, &[0xAB; 64]);
    let result = client.try_draw_card(&session_id, &5u32, &mock_proof, &false, &0b0001u32);
    assert!(result.is_err());
}
