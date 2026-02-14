pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

// Merkle Tree Inclusion Proof
// Verifies that a leaf exists in a Merkle tree at a given index with a given root.
// nLevels: Height of the tree

template MerkleProof(nLevels) {
    signal input leaf;
    signal input pathElements[nLevels];
    signal input pathIndices[nLevels]; // 0 for left, 1 for right
    signal input root;

    component hashers[nLevels];
    component mux[nLevels];

    signal currentHash[nLevels + 1];
    currentHash[0] <== leaf;

    for (var i = 0; i < nLevels; i++) {
        hashers[i] = Poseidon(2);

        // Selector to swap input ordering based on pathIndices
        // if pathIndices[i] == 0: hash(current, element)
        // if pathIndices[i] == 1: hash(element, current)
        
        // Using a mathematical trick or a Mux1 component
        // left = current - index * (current - element)
        // right = element - index * (element - current)
        
        var d = pathElements[i] - currentHash[i];

        hashers[i].inputs[0] <== currentHash[i] + pathIndices[i] * d;
        hashers[i].inputs[1] <== pathElements[i] - pathIndices[i] * d;

        currentHash[i+1] <== hashers[i].out;
    }

    root === currentHash[nLevels];
}
