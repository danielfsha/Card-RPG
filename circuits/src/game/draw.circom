pragma circom 2.0.0;

include "../utils/merkle.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";

// Draw Card Circuit
// Proves that a card was drawn from the committed deck and does not cause a bust.
// Card Value Format: ID(0-7), Suit(8-11), Rank(12-15), ATK(16-27), DEF(28-39), Type(40-43), Attr(44-47)
// Max Suits = 16 (4 bits)

template DrawCard(nLevels) {
    // Public Inputs
    signal input deckRoot;
    signal input currentSuitsMask; // Bitmask of currently active suits in Play Area
    signal input cardIndex; // Index of card in deck (for Merkle proof)

    // Private Inputs
    signal input cardValue;
    signal input pathElements[nLevels];
    signal input pathIndices[nLevels];
    
    // Outputs
    signal output newSuitsMask;
    signal output isBust; // 1 if bust, 0 if valid
    signal output drawnSuit; // The suit that was drawn

    // 1. Verify Card is in Deck using Merkle proof
    component merkle = MerkleProof(nLevels);
    merkle.leaf <== cardValue;
    merkle.root <== deckRoot;
    for (var i = 0; i < nLevels; i++) {
        merkle.pathElements[i] <== pathElements[i];
        merkle.pathIndices[i] <== pathIndices[i];
    }

    // 2. Extract Suit from Card Value (bits 8-11)
    component cardBits = Num2Bits(64);
    cardBits.in <== cardValue;

    component suitBits = Bits2Num(4);
    suitBits.in[0] <== cardBits.out[8];
    suitBits.in[1] <== cardBits.out[9];
    suitBits.in[2] <== cardBits.out[10];
    suitBits.in[3] <== cardBits.out[11];
    
    signal suit <== suitBits.out;
    drawnSuit <== suit;

    // 3. Check for Bust (is Suit already in currentSuitsMask?)
    component maskBits = Num2Bits(16);
    maskBits.in <== currentSuitsMask;
    
    // Check if the suit bit is already set
    signal bustCheck[16];
    signal bustSum[17];
    bustSum[0] <== 0;
    
    component equals[16];

    for (var i = 0; i < 16; i++) {
        equals[i] = IsEqual();
        equals[i].in[0] <== i;
        equals[i].in[1] <== suit;
        
        // If (i == suit) AND (maskBits.out[i] == 1) -> Bust
        bustCheck[i] <== equals[i].out * maskBits.out[i];
        bustSum[i+1] <== bustSum[i] + bustCheck[i];
    }

    isBust <== bustSum[16];

    // 4. Calculate New Mask (set the suit bit)
    component newMaskCalc = Bits2Num(16);
    signal newBits[16];
    
    for (var i = 0; i < 16; i++) {
        // OR operation: newBit = oldBit + (i==suit) - oldBit*(i==suit)
        newBits[i] <== maskBits.out[i] + equals[i].out - (maskBits.out[i] * equals[i].out);
        newMaskCalc.in[i] <== newBits[i];
    }
    
    newSuitsMask <== newMaskCalc.out;
}
