pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Movement Circuit - Verifies player movement is valid
 * 
 * Ensures:
 * - Old position commitment is valid
 * - Movement distance is within max speed
 * - New position is within map bounds
 * - New position commitment is valid
 */
template Movement() {
    // Public inputs
    signal input old_position_commitment;
    signal input new_position_commitment;
    signal input timestamp_delta;  // Time since last move (seconds)
    
    // Private inputs
    signal input old_x;
    signal input old_y;
    signal input old_z;
    signal input old_salt;
    
    signal input new_x;
    signal input new_y;
    signal input new_z;
    signal input new_salt;
    
    // Outputs
    signal output is_valid;
    
    // Constants
    var MAX_SPEED = 10;  // Units per second
    var MAP_MIN_X = -50;
    var MAP_MAX_X = 50;
    var MAP_MIN_Y = 0;
    var MAP_MAX_Y = 20;
    var MAP_MIN_Z = -50;
    var MAP_MAX_Z = 50;
    
    // 1. Verify old position commitment
    component old_poseidon = Poseidon(4);
    old_poseidon.inputs[0] <== old_x;
    old_poseidon.inputs[1] <== old_y;
    old_poseidon.inputs[2] <== old_z;
    old_poseidon.inputs[3] <== old_salt;
    
    component old_commitment_check = IsEqual();
    old_commitment_check.in[0] <== old_poseidon.out;
    old_commitment_check.in[1] <== old_position_commitment;
    
    // 2. Calculate movement distance
    signal dx <== new_x - old_x;
    signal dy <== new_y - old_y;
    signal dz <== new_z - old_z;
    
    signal dx_squared <== dx * dx;
    signal dy_squared <== dy * dy;
    signal dz_squared <== dz * dz;
    
    signal distance_squared <== dx_squared + dy_squared + dz_squared;
    
    // 3. Verify distance is within max speed * time
    signal max_distance <== MAX_SPEED * timestamp_delta;
    signal max_distance_squared <== max_distance * max_distance;
    
    component distance_check = LessEqThan(64);
    distance_check.in[0] <== distance_squared;
    distance_check.in[1] <== max_distance_squared;
    
    // 4. Verify new position is within map bounds
    component new_x_min = GreaterEqThan(32);
    new_x_min.in[0] <== new_x;
    new_x_min.in[1] <== MAP_MIN_X;
    
    component new_x_max = LessEqThan(32);
    new_x_max.in[0] <== new_x;
    new_x_max.in[1] <== MAP_MAX_X;
    
    component new_y_min = GreaterEqThan(32);
    new_y_min.in[0] <== new_y;
    new_y_min.in[1] <== MAP_MIN_Y;
    
    component new_y_max = LessEqThan(32);
    new_y_max.in[0] <== new_y;
    new_y_max.in[1] <== MAP_MAX_Y;
    
    component new_z_min = GreaterEqThan(32);
    new_z_min.in[0] <== new_z;
    new_z_min.in[1] <== MAP_MIN_Z;
    
    component new_z_max = LessEqThan(32);
    new_z_max.in[0] <== new_z;
    new_z_max.in[1] <== MAP_MAX_Z;
    
    // 5. Verify new position commitment
    component new_poseidon = Poseidon(4);
    new_poseidon.inputs[0] <== new_x;
    new_poseidon.inputs[1] <== new_y;
    new_poseidon.inputs[2] <== new_z;
    new_poseidon.inputs[3] <== new_salt;
    
    component new_commitment_check = IsEqual();
    new_commitment_check.in[0] <== new_poseidon.out;
    new_commitment_check.in[1] <== new_position_commitment;
    
    // All checks must pass (break down to avoid non-quadratic constraints)
    signal check1 <== old_commitment_check.out * distance_check.out;
    signal check2 <== check1 * new_x_min.out;
    signal check3 <== check2 * new_x_max.out;
    signal check4 <== check3 * new_y_min.out;
    signal check5 <== check4 * new_y_max.out;
    signal check6 <== check5 * new_z_min.out;
    signal check7 <== check6 * new_z_max.out;
    is_valid <== check7 * new_commitment_check.out;
}

component main = Movement();
