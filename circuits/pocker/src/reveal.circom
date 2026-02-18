pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// Community Card Reveal Circuit
// Proves a revealed card matches the pre-deal commitment
template CommunityReveal() {
    signal input community_commitment;
    signal input card_index;  // Which card to reveal (0-4)
    signal input revealed_cards[5];  // All 5 community cards
    signal input reveal_salt;
    
    signal output revealed_card;
    
    // Verify the commitment matches
    component hasher = Poseidon(6);
    for (var i = 0; i < 5; i++) {
        hasher.inputs[i] <== revealed_cards[i];
    }
    hasher.inputs[5] <== reveal_salt;
    
    hasher.out === community_commitment;
    
    // Verify card_index is in valid range [0, 4]
    component indexCheck = LessThan(8);
    indexCheck.in[0] <== card_index;
    indexCheck.in[1] <== 5;
    indexCheck.out === 1;
    
    // Extract the card at the specified index using IsEqual components
    component isIndex[5];
    signal selector[5];
    for (var i = 0; i < 5; i++) {
        isIndex[i] = IsEqual();
        isIndex[i].in[0] <== card_index;
        isIndex[i].in[1] <== i;
        selector[i] <== isIndex[i].out;
    }
    
    signal accumulated[5];
    accumulated[0] <== selector[0] * revealed_cards[0];
    for (var i = 1; i < 5; i++) {
        accumulated[i] <== accumulated[i-1] + selector[i] * revealed_cards[i];
    }
    
    revealed_card <== accumulated[4];
}

component main {public [community_commitment, card_index]} = CommunityReveal();
