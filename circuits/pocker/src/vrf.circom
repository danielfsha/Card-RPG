pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

// VRF Circuit for Dealer Button Selection
// Combines two player seeds to generate a provably random dealer assignment
template VRFDealerSelection() {
    signal input player1_seed;
    signal input player2_seed;
    
    signal output dealer_button;  // 0 = player1, 1 = player2
    
    // Combine seeds using Poseidon hash
    component hasher = Poseidon(2);
    hasher.inputs[0] <== player1_seed;
    hasher.inputs[1] <== player2_seed;
    
    // Extract random bit (LSB of hash)
    signal hash_output;
    hash_output <== hasher.out;
    
    // Modulo 2 to get 0 or 1
    dealer_button <-- hash_output % 2;
    
    // Verify the modulo operation
    signal check;
    check <== dealer_button * 2;
    hash_output === check + dealer_button;
    
    // Ensure dealer_button is 0 or 1
    dealer_button * (dealer_button - 1) === 0;
}

component main = VRFDealerSelection();
