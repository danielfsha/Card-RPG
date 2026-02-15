pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/mux1.circom";

// Merkle Tree Inclusion Proof using Poseidon hash
// Verifies that a leaf exists in a Merkle tree at a given index with a given root.
// nLevels: Height of the tree (e.g., 6 for 64 leaves)

template MerkleProof(nLevels) {
    signal input leaf;
    signal input pathElements[nLevels];
    signal input pathIndices[nLevels]; // 0 for left, 1 for right
    signal input root;

    component hashers[nLevels];
    component selectors[nLevels];

    signal currentHash[nLevels + 1];
    currentHash[0] <== leaf;

    for (var i = 0; i < nLevels; i++) {
        // Constrain pathIndices to be binary
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        selectors[i] = Mux1();
        selectors[i].c[0] <== currentHash[i];
        selectors[i].c[1] <== pathElements[i];
        selectors[i].s <== pathIndices[i];

        hashers[i] = Poseidon(2);
        // If pathIndices[i] == 0: hash(currentHash, pathElement)
        // If pathIndices[i] == 1: hash(pathElement, currentHash)
        hashers[i].inputs[0] <== currentHash[i] - selectors[i].out + pathElements[i];
        hashers[i].inputs[1] <== selectors[i].out;

        currentHash[i+1] <== hashers[i].out;
    }

    // Constrain final hash to equal root
    root === currentHash[nLevels];
}
