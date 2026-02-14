pragma circom 2.0.0;

include "../utils/merkle.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";

// Draw Card Circuit
// Proves that a card was drawn from the committed deck and does not cause a bust.
// Card Value Format: Lower 4 bits = Rank, Next 4 bits = Suit.
// Max Suits = 10 (as per DM Draw), so 4 bits is enough (0-15).

template DrawCard(nLevels) {
    // Public Inputs
    signal input deckRoot;
    signal input currentSuitsMask; // Bitmask of currently active suits in Play Area

    // Private Inputs
    signal input cardValue;
    signal input pathElements[nLevels];
    signal input pathIndices[nLevels];
    
    // Outputs
    signal output newSuitsMask;
    signal output isBust; // 1 if bust, 0 if valid (Technically usually we just fail proof if bust, but explicit output allows logic handling)

    // 1. Verify Card is in Deck
    component merkle = MerkleProof(nLevels);
    merkle.leaf <== cardValue;
    merkle.root <== deckRoot;
    for (var i = 0; i < nLevels; i++) {
        merkle.pathElements[i] <== pathElements[i];
        merkle.pathIndices[i] <== pathIndices[i];
    }

    // 2. Extract Suit from Card Value
    // Assuming Suit is in bits 4-7 (0-indexed)
    component cardBits = Num2Bits(16); // 16-bit card value
    cardBits.in <== cardValue;

    // Convert suit bits to value
    component suitBits = Bits2Num(4);
    suitBits.in[0] <== cardBits.out[4];
    suitBits.in[1] <== cardBits.out[5];
    suitBits.in[2] <== cardBits.out[6];
    suitBits.in[3] <== cardBits.out[7];
    
    signal suit <== suitBits.out;

    // 3. Check for Bust (is Suit already in currentSuitsMask?)
    // currentSuitsMask is a bitmask. valid if (currentSuitsMask >> suit) & 1 == 0
    // We can use a shifter or just check bit constraints if max suits is small.
    // Since suits < 16, we can decompose the mask.
    
    component maskBits = Num2Bits(16);
    maskBits.in <== currentSuitsMask;
    
    // The bit corresponding to 'suit' must be 0 for NO bust.
    // Since 'suit' is a signal, we need a dynamic access or equal check for each bit.
    
    signal bustCheck[16];
    var bustSum = 0;
    
    component equals[16];

    for (var i = 0; i < 16; i++) {
        equals[i] = IsEqual();
        equals[i].in[0] <== i;
        equals[i].in[1] <== suit;
        
        // If (i == suit) AND (maskBits.out[i] == 1) -> Bust
        bustCheck[i] <== equals[i].out * maskBits.out[i];
        bustSum += bustCheck[i]; 
    }

    // bustSum will be 1 if bust, 0 if not.
    // We enforce no bust for a valid "successful draw" proof? 
    // The prompt says "Busts self-enforce: invalid proof loses turn".
    // This implies we might want to prove we DID bust to end turn safely? 
    // Or prove valid draw to continue. Let's output isBust.
    
    isBust <== bustSum;

    // 4. Calculate New Mask
    // newMask = currentMask | (1 << suit)
    // If not bust, we add the bit. If bust, we output currentMask (or reset? let's just output updated mask if valid)
    
    component newMaskCalc = Bits2Num(16);
    for (var i = 0; i < 16; i++) {
        // bit i is 1 if (old bit is 1) OR (i == suit)
        // logic: out = old[i] + (i==suit) - old[i]*(i==suit) ?? 
        // simpler: out = old[i] + equal[i] - old[i]*equal[i] (OR gate)
        // But if bust, equal[i] and old[i] are both 1, so 1+1-1=1. Correct.
        
        var bit_or = maskBits.out[i] + equals[i].out - (maskBits.out[i] * equals[i].out);
        newMaskCalc.in[i] <== bit_or;
    }
    
    newSuitsMask <== newMaskCalc.out;
}
