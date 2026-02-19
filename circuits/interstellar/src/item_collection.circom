pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Item Collection Circuit - Verifies player collected an item
 * 
 * Ensures:
 * - Player position commitment is valid
 * - Player is within collection radius of item
 * - Inventory update is valid
 */
template ItemCollection() {
    // Public inputs
    signal input player_position_commitment;
    signal input old_inventory_commitment;
    signal input new_inventory_commitment;
    signal input item_x;
    signal input item_y;
    signal input item_z;
    signal input item_type;  // 0=health, 1=ammo, 2=weapon, 3=powerup
    signal input item_id;
    
    // Private inputs - Player position
    signal input player_x;
    signal input player_y;
    signal input player_z;
    signal input position_salt;
    
    // Private inputs - Inventory
    signal input old_health_packs;
    signal input old_ammo;
    signal input old_weapon_level;
    signal input old_powerup;
    signal input old_inventory_salt;
    
    signal input new_health_packs;
    signal input new_ammo;
    signal input new_weapon_level;
    signal input new_powerup;
    signal input new_inventory_salt;
    
    // Outputs
    signal output is_valid;
    
    // Constants
    var COLLECTION_RADIUS = 2;
    var MAX_HEALTH_PACKS = 5;
    var MAX_AMMO = 100;
    var MAX_WEAPON_LEVEL = 3;
    
    // 1. Verify player position commitment
    component pos_poseidon = Poseidon(4);
    pos_poseidon.inputs[0] <== player_x;
    pos_poseidon.inputs[1] <== player_y;
    pos_poseidon.inputs[2] <== player_z;
    pos_poseidon.inputs[3] <== position_salt;
    
    component pos_check = IsEqual();
    pos_check.in[0] <== pos_poseidon.out;
    pos_check.in[1] <== player_position_commitment;
    
    // 2. Calculate distance to item
    signal dx <== player_x - item_x;
    signal dy <== player_y - item_y;
    signal dz <== player_z - item_z;
    
    signal dx_squared <== dx * dx;
    signal dy_squared <== dy * dy;
    signal dz_squared <== dz * dz;
    
    signal distance_squared <== dx_squared + dy_squared + dz_squared;
    signal collection_radius_squared <== COLLECTION_RADIUS * COLLECTION_RADIUS;
    
    component distance_check = LessEqThan(64);
    distance_check.in[0] <== distance_squared;
    distance_check.in[1] <== collection_radius_squared;
    
    // 3. Verify old inventory commitment
    component old_inv_poseidon = Poseidon(5);
    old_inv_poseidon.inputs[0] <== old_health_packs;
    old_inv_poseidon.inputs[1] <== old_ammo;
    old_inv_poseidon.inputs[2] <== old_weapon_level;
    old_inv_poseidon.inputs[3] <== old_powerup;
    old_inv_poseidon.inputs[4] <== old_inventory_salt;
    
    component old_inv_check = IsEqual();
    old_inv_check.in[0] <== old_inv_poseidon.out;
    old_inv_check.in[1] <== old_inventory_commitment;
    
    // 4. Verify inventory update based on item type
    component is_health = IsEqual();
    is_health.in[0] <== item_type;
    is_health.in[1] <== 0;
    
    component is_ammo = IsEqual();
    is_ammo.in[0] <== item_type;
    is_ammo.in[1] <== 1;
    
    component is_weapon = IsEqual();
    is_weapon.in[0] <== item_type;
    is_weapon.in[1] <== 2;
    
    component is_powerup = IsEqual();
    is_powerup.in[0] <== item_type;
    is_powerup.in[1] <== 3;
    
    // Expected new values based on item type
    signal expected_health_packs <== old_health_packs + is_health.out;
    signal expected_ammo <== old_ammo + is_ammo.out * 20;  // +20 ammo per pickup
    signal expected_weapon_level <== old_weapon_level + is_weapon.out;
    signal expected_powerup <== old_powerup + is_powerup.out;
    
    // Verify new values match expected
    component health_check = IsEqual();
    health_check.in[0] <== new_health_packs;
    health_check.in[1] <== expected_health_packs;
    
    component ammo_check = IsEqual();
    ammo_check.in[0] <== new_ammo;
    ammo_check.in[1] <== expected_ammo;
    
    component weapon_check = IsEqual();
    weapon_check.in[0] <== new_weapon_level;
    weapon_check.in[1] <== expected_weapon_level;
    
    component powerup_check = IsEqual();
    powerup_check.in[0] <== new_powerup;
    powerup_check.in[1] <== expected_powerup;
    
    // 5. Verify new inventory commitment
    component new_inv_poseidon = Poseidon(5);
    new_inv_poseidon.inputs[0] <== new_health_packs;
    new_inv_poseidon.inputs[1] <== new_ammo;
    new_inv_poseidon.inputs[2] <== new_weapon_level;
    new_inv_poseidon.inputs[3] <== new_powerup;
    new_inv_poseidon.inputs[4] <== new_inventory_salt;
    
    component new_inv_check = IsEqual();
    new_inv_check.in[0] <== new_inv_poseidon.out;
    new_inv_check.in[1] <== new_inventory_commitment;
    
    // All checks must pass (break down to avoid non-quadratic constraints)
    signal check1 <== pos_check.out * distance_check.out;
    signal check2 <== check1 * old_inv_check.out;
    signal check3 <== check2 * new_inv_check.out;
    signal check4 <== check3 * health_check.out;
    signal check5 <== check4 * ammo_check.out;
    signal check6 <== check5 * weapon_check.out;
    is_valid <== check6 * powerup_check.out;
}

component main = ItemCollection();
