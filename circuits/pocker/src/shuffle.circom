pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// Deck Shuffle Circuit
// Verifies a valid shuffle permutation without revealing it
template DeckShuffle() {
    signal input original_deck[52];
    signal input permutation[52];
    signal input player_id;
    signal input shuffle_salt;
    
    signal output shuffled_deck[52];
    signal output commitment;
    
    // Apply permutation
    for (var i = 0; i < 52; i++) {
        shuffled_deck[i] <== original_deck[permutation[i]];
    }
    
    // Verify each permutation index is in range [0, 51]
    component inRange[52];
    for (var i = 0; i < 52; i++) {
        inRange[i] = LessThan(8);
        inRange[i].in[0] <== permutation[i];
        inRange[i].in[1] <== 52;
        inRange[i].out === 1;
    }
    
    // Check no duplicates using pairwise comparisons
    // This is expensive but necessary for security
    component notEqual[1326];  // 52*51/2 = 1326 comparisons
    var idx = 0;
    for (var i = 0; i < 52; i++) {
        for (var j = i+1; j < 52; j++) {
            notEqual[idx] = IsEqual();
            notEqual[idx].in[0] <== permutation[i];
            notEqual[idx].in[1] <== permutation[j];
            notEqual[idx].out === 0;  // Must not be equal
            idx++;
        }
    }
    
    // Commit to shuffled deck using Poseidon hash
    // Split into chunks due to Poseidon input limits
    component hasher1 = Poseidon(16);
    for (var i = 0; i < 16; i++) {
        hasher1.inputs[i] <== shuffled_deck[i];
    }
    
    component hasher2 = Poseidon(16);
    for (var i = 0; i < 16; i++) {
        hasher2.inputs[i] <== shuffled_deck[i + 16];
    }
    
    component hasher3 = Poseidon(16);
    for (var i = 0; i < 16; i++) {
        hasher3.inputs[i] <== shuffled_deck[i + 32];
    }
    
    component hasher4 = Poseidon(6);
    for (var i = 0; i < 4; i++) {
        hasher4.inputs[i] <== shuffled_deck[i + 48];
    }
    hasher4.inputs[4] <== player_id;
    hasher4.inputs[5] <== shuffle_salt;
    
    // Combine all hashes
    component finalHasher = Poseidon(4);
    finalHasher.inputs[0] <== hasher1.out;
    finalHasher.inputs[1] <== hasher2.out;
    finalHasher.inputs[2] <== hasher3.out;
    finalHasher.inputs[3] <== hasher4.out;
    
    commitment <== finalHasher.out;
}

component main {public [original_deck]} = DeckShuffle();
