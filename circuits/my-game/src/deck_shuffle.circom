pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// Prove you have a valid deck commitment (40 cards)
// Uses grouped hashing to avoid "Out of bounds" errors
template DeckCommitment() {
    signal input cards[40];  // Card IDs
    signal input salt;
    
    signal output deckCommitment;
    
    // Hash cards in groups of 10 to avoid Poseidon input limit
    // 40 cards -> 4 groups of 10
    component groupHashers[4];
    signal groupHashes[4];
    
    for (var i = 0; i < 4; i++) {
        groupHashers[i] = Poseidon(10);
        for (var j = 0; j < 10; j++) {
            groupHashers[i].inputs[j] <== cards[i * 10 + j];
        }
        groupHashes[i] <== groupHashers[i].out;
    }
    
    // Hash the 4 group hashes + salt
    component finalHasher = Poseidon(5);
    for (var i = 0; i < 4; i++) {
        finalHasher.inputs[i] <== groupHashes[i];
    }
    finalHasher.inputs[4] <== salt;
    
    deckCommitment <== finalHasher.out;
}

component main = DeckCommitment();
