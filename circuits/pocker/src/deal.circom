pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// Card Deal Circuit
// Proves cards are dealt from the top of the shuffled deck
template CardDeal() {
    signal input shuffled_deck[52];
    
    signal output dealt_cards[9];
    signal output hole_commitment_p1;
    signal output hole_commitment_p2;
    signal output community_commitment;
    
    // Deal first 9 cards from top of deck (fixed positions 0-8)
    for (var i = 0; i < 9; i++) {
        dealt_cards[i] <== shuffled_deck[i];
    }
    
    // Create commitment for player 1 hole cards (positions 0, 1)
    component p1Hasher = Poseidon(2);
    p1Hasher.inputs[0] <== dealt_cards[0];
    p1Hasher.inputs[1] <== dealt_cards[1];
    hole_commitment_p1 <== p1Hasher.out;
    
    // Create commitment for player 2 hole cards (positions 2, 3)
    component p2Hasher = Poseidon(2);
    p2Hasher.inputs[0] <== dealt_cards[2];
    p2Hasher.inputs[1] <== dealt_cards[3];
    hole_commitment_p2 <== p2Hasher.out;
    
    // Create commitment for community cards (positions 4-8)
    component commHasher = Poseidon(5);
    for (var i = 0; i < 5; i++) {
        commHasher.inputs[i] <== dealt_cards[i + 4];
    }
    community_commitment <== commHasher.out;
}

component main = CardDeal();
