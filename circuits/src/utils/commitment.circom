pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

// Card Commitment using Poseidon hash (ZK-friendly, efficient)
// Commitment = Poseidon(cardValue, blindingFactor)
// This is compatible with Stellar's Protocol 25 Poseidon support

template CardCommitment() {
    signal input cardValue; // Card ID/Value
    signal input blindingFactor; // Random nonce for hiding
    
    signal output commitment;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== cardValue;
    hasher.inputs[1] <== blindingFactor;

    commitment <== hasher.out;
}

// Verify a card commitment matches the revealed values
template VerifyCommitment() {
    signal input cardValue;
    signal input blindingFactor;
    signal input commitment;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== cardValue;
    hasher.inputs[1] <== blindingFactor;

    // Constrain that computed hash equals provided commitment
    commitment === hasher.out;
}
