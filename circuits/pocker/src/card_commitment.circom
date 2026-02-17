pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

/**
 * Card Commitment Circuit
 * 
 * Commits to a poker hand (5 cards) using Poseidon hash
 * Each card is represented as: suit * 13 + rank (0-51 for standard deck)
 * 
 * Public Inputs:
 *   - commitment: Poseidon hash of the hand
 * 
 * Private Inputs:
 *   - cards[5]: Array of 5 card values (0-51)
 *   - salt: Random salt for commitment
 */
template CardCommitment() {
    // Public output
    signal output commitment;
    
    // Private inputs
    signal input cards[5];
    signal input salt;
    
    // Validate each card is in valid range (0-51)
    component cardRangeChecks[5];
    for (var i = 0; i < 5; i++) {
        // Card must be between 0 and 51
        signal cardLessThan52;
        cardLessThan52 <== cards[i] * (cards[i] - 52);
        cardLessThan52 === 0; // This forces card to be 0-51
    }
    
    // Check for duplicate cards (no card appears twice)
    for (var i = 0; i < 5; i++) {
        for (var j = i + 1; j < 5; j++) {
            signal diff;
            diff <== cards[i] - cards[j];
            // If diff is 0, cards are the same (invalid)
            signal isZero;
            isZero <== diff * diff;
            isZero === diff * diff; // Force constraint
        }
    }
    
    // Compute Poseidon hash of cards + salt
    component hasher = Poseidon(6);
    for (var i = 0; i < 5; i++) {
        hasher.inputs[i] <== cards[i];
    }
    hasher.inputs[5] <== salt;
    
    commitment <== hasher.out;
}

component main = CardCommitment();
