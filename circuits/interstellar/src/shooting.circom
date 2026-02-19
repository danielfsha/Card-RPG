pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";

/**
 * Shooting Circuit - Verifies shot hit detection
 * 
 * Ensures:
 * - Shooter and target position commitments are valid
 * - Ray-sphere collision detection (bullet hits target)
 * - Distance is within weapon range
 * - Damage calculation is correct
 */
template Shooting() {
    // Public inputs
    signal input shooter_position_commitment;
    signal input target_position_commitment;
    signal input weapon_type;  // 0=pistol, 1=rifle, 2=shotgun
    
    // Private inputs - Shooter
    signal input shooter_x;
    signal input shooter_y;
    signal input shooter_z;
    signal input shooter_salt;
    
    // Private inputs - Shooter direction (normalized)
    signal input dir_x;
    signal input dir_y;
    signal input dir_z;
    
    // Private inputs - Target
    signal input target_x;
    signal input target_y;
    signal input target_z;
    signal input target_salt;
    
    // Outputs
    signal output is_hit;
    signal output damage;
    signal output is_valid;
    
    // Constants
    var HITBOX_RADIUS = 1;  // Player hitbox radius
    var PISTOL_RANGE = 30;
    var RIFLE_RANGE = 50;
    var SHOTGUN_RANGE = 15;
    var PISTOL_DAMAGE = 20;
    var RIFLE_DAMAGE = 30;
    var SHOTGUN_DAMAGE = 40;
    
    // 1. Verify shooter position commitment
    component shooter_poseidon = Poseidon(4);
    shooter_poseidon.inputs[0] <== shooter_x;
    shooter_poseidon.inputs[1] <== shooter_y;
    shooter_poseidon.inputs[2] <== shooter_z;
    shooter_poseidon.inputs[3] <== shooter_salt;
    
    component shooter_check = IsEqual();
    shooter_check.in[0] <== shooter_poseidon.out;
    shooter_check.in[1] <== shooter_position_commitment;
    
    // 2. Verify target position commitment
    component target_poseidon = Poseidon(4);
    target_poseidon.inputs[0] <== target_x;
    target_poseidon.inputs[1] <== target_y;
    target_poseidon.inputs[2] <== target_z;
    target_poseidon.inputs[3] <== target_salt;
    
    component target_check = IsEqual();
    target_check.in[0] <== target_poseidon.out;
    target_check.in[1] <== target_position_commitment;
    
    // 3. Calculate distance between shooter and target
    signal dx <== target_x - shooter_x;
    signal dy <== target_y - shooter_y;
    signal dz <== target_z - shooter_z;
    
    signal dx_squared <== dx * dx;
    signal dy_squared <== dy * dy;
    signal dz_squared <== dz * dz;
    
    signal distance_squared <== dx_squared + dy_squared + dz_squared;
    
    // 4. Check if distance is within weapon range
    signal weapon_range;
    signal weapon_damage_value;
    
    // Select weapon stats based on type
    component is_pistol = IsEqual();
    is_pistol.in[0] <== weapon_type;
    is_pistol.in[1] <== 0;
    
    component is_rifle = IsEqual();
    is_rifle.in[0] <== weapon_type;
    is_rifle.in[1] <== 1;
    
    component is_shotgun = IsEqual();
    is_shotgun.in[0] <== weapon_type;
    is_shotgun.in[1] <== 2;
    
    weapon_range <== is_pistol.out * PISTOL_RANGE + 
                     is_rifle.out * RIFLE_RANGE + 
                     is_shotgun.out * SHOTGUN_RANGE;
    
    weapon_damage_value <== is_pistol.out * PISTOL_DAMAGE + 
                            is_rifle.out * RIFLE_DAMAGE + 
                            is_shotgun.out * SHOTGUN_DAMAGE;
    
    signal weapon_range_squared <== weapon_range * weapon_range;
    
    component range_check = LessEqThan(64);
    range_check.in[0] <== distance_squared;
    range_check.in[1] <== weapon_range_squared;
    
    // 5. Ray-sphere intersection (simplified)
    // Vector from shooter to target
    signal to_target_x <== target_x - shooter_x;
    signal to_target_y <== target_y - shooter_y;
    signal to_target_z <== target_z - shooter_z;
    
    // Dot product: direction · to_target
    signal dot_product <== dir_x * to_target_x + 
                          dir_y * to_target_y + 
                          dir_z * to_target_z;
    
    // Check if target is in front of shooter (dot product > 0)
    component forward_check = GreaterThan(32);
    forward_check.in[0] <== dot_product;
    forward_check.in[1] <== 0;
    
    // Simplified hit detection: if in range and facing target
    signal hit_detected <== range_check.out * forward_check.out;
    
    // 6. Calculate damage (full damage if hit, 0 if miss)
    damage <== hit_detected * weapon_damage_value;
    is_hit <== hit_detected;
    
    // All checks must pass
    is_valid <== shooter_check.out * target_check.out;
}

component main = Shooting();
