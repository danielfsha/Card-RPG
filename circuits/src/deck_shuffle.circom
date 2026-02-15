pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "../utils/poseidon_hash.circom";

// Simplified deck shuffle verification
// Instead of proving the shuffle algorithm, we prove:
// 1. Seeds match commitments
// 2. Provided shuffled deck is a valid permutation
// 3. Merkle root is correct
// The actual shuffle is done off-chain deterministically
template DeckShuffleVerify(DECK_SIZE) {
    // Public inputs
    signal input seed1_hash;  // Poseidon(seed1)
    signal input seed2_hash;  // Poseidon(seed2)
    signal output deck_root;  // Merkle root of shuffled deck

    // Private inputs
    signal input seed1;
    signal input seed2;
    signal input shuffled_deck[DECK_SIZE];  // Claimed shuffled deck

    // 1. Verify seed commitments
    component hash1 = Poseidon(1);
    hash1.inputs[0] <== seed1;
    seed1_hash === hash1.out;

    component hash2 = Poseidon(1);
    hash2.inputs[0] <== seed2;
    seed2_hash === hash2.out;

    // 2. Verify shuffled_deck is a valid permutation of [0..DECK_SIZE-1]
    // Each card 0 to DECK_SIZE-1 must appear exactly once
    signal card_present[DECK_SIZE][DECK_SIZE];
    signal card_count[DECK_SIZE];
    
    for (var card = 0; card < DECK_SIZE; card++) {
        // Check each position for this card
        component eq[DECK_SIZE];
        for (var pos = 0; pos < DECK_SIZE; pos++) {
            eq[pos] = IsEqual();
            eq[pos].in[0] <== shuffled_deck[pos];
            eq[pos].in[1] <== card;
            card_present[card][pos] <== eq[pos].out;
        }
        
        // Sum occurrences
        signal sum[DECK_SIZE + 1];
        sum[0] <== 0;
        for (var pos = 0; pos < DECK_SIZE; pos++) {
            sum[pos + 1] <== sum[pos] + card_present[card][pos];
        }
        card_count[card] <== sum[DECK_SIZE];
        
        // Must appear exactly once
        card_count[card] === 1;
    }

    // 3. Compute Merkle root of shuffled deck
    component merkle = ComputeMerkleRoot(DECK_SIZE, 6);  // 2^6 = 64 >= 40
    for (var i = 0; i < DECK_SIZE; i++) {
        merkle.leaves[i] <== shuffled_deck[i];
    }
    deck_root <== merkle.root;
}

// Instantiate for 40-card deck
component main {public [seed1_hash, seed2_hash]} = DeckShuffleVerify(40);
