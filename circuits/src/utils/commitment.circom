pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/pedersen.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";

// Commitment: Hash(card_value + blinding_factor)
// We typically use Pedersen for high efficiency in constraints if interacting with Ethereum, 
// or Poseidon if standardizing on ZK-friendly hash. 
// Detailed prompt asks for Pedersen.

template CardCommitment() {
    signal input cardValue; // Card ID/Value
    signal input blindingFactor;
    
    signal output commitment;

    component pedersen = Pedersen(256); // 256 bits of input
    component cardBits = Num2Bits(128);
    component blindBits = Num2Bits(128);

    cardBits.in <== cardValue;
    blindBits.in <== blindingFactor;

    for (var i = 0; i < 128; i++) {
        pedersen.in[i] <== cardBits.out[i];
        pedersen.in[i + 128] <== blindBits.out[i];
    }

    commitment <== pedersen.out[0];
}
