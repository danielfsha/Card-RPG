pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// Prove you drew a card honestly from your committed deck
// Drawing costs 500 LP
template CardDraw() {
    signal input deckCommitment;      // Commitment of your deck
    signal input drawnCardId;         // Card you drew (ID)
    signal input drawnCardATK;
    signal input drawnCardDEF;
    signal input remainingCards[39];  // Your deck after drawing (39 cards)
    signal input playerLP;            // Current LP
    signal input salt;
    
    signal output newDeckCommitment;
    signal output drawnCardHash;
    signal output newLP;              // LP after 500 cost
    
    // Verify LP is sufficient (>= 500)
    component lpCheck = GreaterEqThan(16);
    lpCheck.in[0] <== playerLP;
    lpCheck.in[1] <== 500;
    lpCheck.out === 1;
    
    // Reconstruct original deck commitment
    // Original deck = [drawnCard, ...remainingCards]
    // We need to hash 40 cards in groups to avoid "Out of bounds"
    
    // Group 1: drawn card + first 9 remaining (10 cards)
    component group1Hasher = Poseidon(10);
    group1Hasher.inputs[0] <== drawnCardId;
    for (var j = 1; j < 10; j++) {
        group1Hasher.inputs[j] <== remainingCards[j - 1];
    }
    signal group1Hash;
    group1Hash <== group1Hasher.out;
    
    // Group 2: next 10 cards (indices 9-18)
    component group2Hasher = Poseidon(10);
    for (var j = 0; j < 10; j++) {
        group2Hasher.inputs[j] <== remainingCards[9 + j];
    }
    signal group2Hash;
    group2Hash <== group2Hasher.out;
    
    // Group 3: next 10 cards (indices 19-28)
    component group3Hasher = Poseidon(10);
    for (var j = 0; j < 10; j++) {
        group3Hasher.inputs[j] <== remainingCards[19 + j];
    }
    signal group3Hash;
    group3Hash <== group3Hasher.out;
    
    // Group 4: last 10 cards (indices 29-38)
    component group4Hasher = Poseidon(10);
    for (var j = 0; j < 10; j++) {
        group4Hasher.inputs[j] <== remainingCards[29 + j];
    }
    signal group4Hash;
    group4Hash <== group4Hasher.out;
    
    // Final hash: combine group hashes with salt
    component deckHasher = Poseidon(5);
    deckHasher.inputs[0] <== group1Hash;
    deckHasher.inputs[1] <== group2Hash;
    deckHasher.inputs[2] <== group3Hash;
    deckHasher.inputs[3] <== group4Hash;
    deckHasher.inputs[4] <== salt;
    
    // Verify commitment matches
    signal commitmentMatch;
    commitmentMatch <== deckHasher.out - deckCommitment;
    commitmentMatch === 0;
    
    // Compute new deck commitment (39 cards)
    // Group 1: first 10 of remaining
    component newGroup1Hasher = Poseidon(10);
    for (var j = 0; j < 10; j++) {
        newGroup1Hasher.inputs[j] <== remainingCards[j];
    }
    signal newGroup1Hash;
    newGroup1Hash <== newGroup1Hasher.out;
    
    // Group 2: next 10 (indices 10-19)
    component newGroup2Hasher = Poseidon(10);
    for (var j = 0; j < 10; j++) {
        newGroup2Hasher.inputs[j] <== remainingCards[10 + j];
    }
    signal newGroup2Hash;
    newGroup2Hash <== newGroup2Hasher.out;
    
    // Group 3: next 10 (indices 20-29)
    component newGroup3Hasher = Poseidon(10);
    for (var j = 0; j < 10; j++) {
        newGroup3Hasher.inputs[j] <== remainingCards[20 + j];
    }
    signal newGroup3Hash;
    newGroup3Hash <== newGroup3Hasher.out;
    
    // Group 4: last 9 + padding (indices 30-38)
    component newGroup4Hasher = Poseidon(10);
    for (var j = 0; j < 9; j++) {
        newGroup4Hasher.inputs[j] <== remainingCards[30 + j];
    }
    newGroup4Hasher.inputs[9] <== 0;  // Padding for 39 cards
    signal newGroup4Hash;
    newGroup4Hash <== newGroup4Hasher.out;
    
    // Final new deck hash
    component newDeckHasher = Poseidon(5);
    newDeckHasher.inputs[0] <== newGroup1Hash;
    newDeckHasher.inputs[1] <== newGroup2Hash;
    newDeckHasher.inputs[2] <== newGroup3Hash;
    newDeckHasher.inputs[3] <== newGroup4Hash;
    newDeckHasher.inputs[4] <== salt;
    newDeckCommitment <== newDeckHasher.out;
    
    // Compute drawn card hash
    component cardHasher = Poseidon(3);
    cardHasher.inputs[0] <== drawnCardId;
    cardHasher.inputs[1] <== drawnCardATK;
    cardHasher.inputs[2] <== drawnCardDEF;
    drawnCardHash <== cardHasher.out;
    
    // Apply 500 LP cost
    newLP <== playerLP - 500;
}

component main {public [deckCommitment, playerLP]} = CardDraw();
