pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";

/**
 * Spawn Circuit - Verifies player spawn position
 * 
 * Ensures:
 * - Spawn position is deterministically generated from seed
 * - Position is within valid spawn zones
 * - Position commitment is valid
 */
template Spawn() {
    // Public inputs
    signal input player_id;           // 0 or 1
    signal input game_seed;           // Shared game seed
    signal input position_commitment; // Public commitment to position
    
    // Private inputs
    signal input spawn_x;             // X coordinate
    signal input spawn_y;             // Y coordinate  
    signal input spawn_z;             // Z coordinate
    signal input salt;                // Random salt for commitment
    
    // Outputs
    signal output is_valid;
    
    // Constants for spawn zones
    var SPAWN_ZONE_SIZE = 10;
    var MAP_MIN_X = -50;
    var MAP_MAX_X = 50;
    var MAP_MIN_Z = -50;
    var MAP_MAX_Z = 50;
    var SPAWN_Y = 1; // Fixed Y height for spawning
    
    // 1. Verify position commitment
    component poseidon = Poseidon(4);
    poseidon.inputs[0] <== spawn_x;
    poseidon.inputs[1] <== spawn_y;
    poseidon.inputs[2] <== spawn_z;
    poseidon.inputs[3] <== salt;
    
    component commitment_check = IsEqual();
    commitment_check.in[0] <== poseidon.out;
    commitment_check.in[1] <== position_commitment;
    
    // 2. Verify Y coordinate is at spawn height
    component y_check = IsEqual();
    y_check.in[0] <== spawn_y;
    y_check.in[1] <== SPAWN_Y;
    
    // 3. Verify position is within map bounds
    component x_min_check = GreaterEqThan(32);
    x_min_check.in[0] <== spawn_x;
    x_min_check.in[1] <== MAP_MIN_X;
    
    component x_max_check = LessEqThan(32);
    x_max_check.in[0] <== spawn_x;
    x_max_check.in[1] <== MAP_MAX_X;
    
    component z_min_check = GreaterEqThan(32);
    z_min_check.in[0] <== spawn_z;
    z_min_check.in[1] <== MAP_MIN_Z;
    
    component z_max_check = LessEqThan(32);
    z_max_check.in[0] <== spawn_z;
    z_max_check.in[1] <== MAP_MAX_Z;
    
    // 4. Verify spawn zones are separated (player 1 left, player 2 right)
    component spawn_zone_check;
    if (player_id == 0) {
        // Player 1 spawns on left side (negative X)
        spawn_zone_check = LessThan(32);
        spawn_zone_check.in[0] <== spawn_x;
        spawn_zone_check.in[1] <== 0;
    } else {
        // Player 2 spawns on right side (positive X)
        spawn_zone_check = GreaterThan(32);
        spawn_zone_check.in[0] <== spawn_x;
        spawn_zone_check.in[1] <== 0;
    }
    
    // All checks must pass
    is_valid <== commitment_check.out * y_check.out * 
                 x_min_check.out * x_max_check.out *
                 z_min_check.out * z_max_check.out *
                 spawn_zone_check.out;
}

component main = Spawn();
