pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

template CardCommitment() {
    signal output commitment;
    
    signal input cards[5];
    signal input salt;
    
    component hasher = Poseidon(6);
    for (var i = 0; i < 5; i++) {
        hasher.inputs[i] <== cards[i];
    }
    hasher.inputs[5] <== salt;
    
    commitment <== hasher.out;
}

component main = CardCommitment();
