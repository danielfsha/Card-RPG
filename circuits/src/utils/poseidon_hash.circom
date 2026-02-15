pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

// Hash two values using Poseidon
template PoseidonHash2() {
    signal input in[2];
    signal output out;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== in[0];
    hasher.inputs[1] <== in[1];
    
    out <== hasher.out;
}

// Hash array of values using Poseidon
template PoseidonHashN(n) {
    signal input in[n];
    signal output out;

    component hasher = Poseidon(n);
    for (var i = 0; i < n; i++) {
        hasher.inputs[i] <== in[i];
    }
    
    out <== hasher.out;
}

// Compute Merkle root from leaves
template ComputeMerkleRoot(nLeaves, nLevels) {
    signal input leaves[nLeaves];
    signal output root;

    // Number of nodes at each level
    var nodesAtLevel[nLevels + 1];
    nodesAtLevel[0] = nLeaves;
    for (var i = 1; i <= nLevels; i++) {
        nodesAtLevel[i] = (nodesAtLevel[i-1] + 1) \ 2;
    }

    // Nodes at each level
    component hashers[nLeaves - 1];
    signal nodes[nLeaves * 2 - 1];

    // Copy leaves to first level
    for (var i = 0; i < nLeaves; i++) {
        nodes[i] <== leaves[i];
    }

    // Build tree bottom-up
    var hasherIdx = 0;
    var nodeIdx = nLeaves;
    var levelStart = 0;
    
    for (var level = 0; level < nLevels; level++) {
        var levelNodes = nodesAtLevel[level];
        var nextLevelNodes = nodesAtLevel[level + 1];
        
        for (var i = 0; i < nextLevelNodes; i++) {
            hashers[hasherIdx] = Poseidon(2);
            
            var leftIdx = levelStart + i * 2;
            var rightIdx = leftIdx + 1;
            
            if (rightIdx < levelStart + levelNodes) {
                hashers[hasherIdx].inputs[0] <== nodes[leftIdx];
                hashers[hasherIdx].inputs[1] <== nodes[rightIdx];
            } else {
                // Odd number of nodes, hash with itself
                hashers[hasherIdx].inputs[0] <== nodes[leftIdx];
                hashers[hasherIdx].inputs[1] <== nodes[leftIdx];
            }
            
            nodes[nodeIdx] <== hashers[hasherIdx].out;
            nodeIdx++;
            hasherIdx++;
        }
        
        levelStart += levelNodes;
    }

    root <== nodes[nLeaves * 2 - 2];
}
