pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

/**
 * Card Reveal Circuit
 * 
 * Proves that revealed cards match a previous commitment
 * Used at showdown to verify players didn't cheat
 * 
 * Public Inputs:
 *   - commitment: Original Poseidon hash commitment
 *   - revealedCards[5]: The cards being revealed
 * 
 * Private Inputs:
 *   - salt: The salt used in original commitment
 */
template CardReveal() {
    // Public inputs
    signal input commitment;
    signal input revealedCards[5];
    
    // Private input
    signal input salt;
    
    // Recompute the commitment with revealed cards and salt
    component hasher = Poseidon(6);
    for (var i = 0; i < 5; i++) {
        hasher.inputs[i] <== revealedCards[i];
    }
    hasher.inputs[5] <== salt;
    
    // Verify it matches the original commitment
    signal commitmentMatch;
    commitmentMatch <== hasher.out - commitment;
    commitmentMatch === 0;
}

component main {public [commitment, revealedCards]} = CardReveal();
