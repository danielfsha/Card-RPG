pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Damage Circuit - Verifies health update after taking damage
 * 
 * Ensures:
 * - Old health commitment is valid
 * - New health = max(0, old_health - damage)
 * - New health commitment is valid
 * - Death status is correct
 */
template Damage() {
    // Public inputs
    signal input old_health_commitment;
    signal input new_health_commitment;
    signal input damage_amount;
    
    // Private inputs
    signal input old_health;
    signal input old_salt;
    signal input new_health;
    signal input new_salt;
    
    // Outputs
    signal output is_dead;
    signal output is_valid;
    
    // Constants
    var MAX_HEALTH = 100;
    
    // 1. Verify old health commitment
    component old_poseidon = Poseidon(2);
    old_poseidon.inputs[0] <== old_health;
    old_poseidon.inputs[1] <== old_salt;
    
    component old_check = IsEqual();
    old_check.in[0] <== old_poseidon.out;
    old_check.in[1] <== old_health_commitment;
    
    // 2. Verify old health is in valid range
    component old_health_min = GreaterEqThan(32);
    old_health_min.in[0] <== old_health;
    old_health_min.in[1] <== 0;
    
    component old_health_max = LessEqThan(32);
    old_health_max.in[0] <== old_health;
    old_health_max.in[1] <== MAX_HEALTH;
    
    // 3. Calculate expected new health
    signal health_after_damage <== old_health - damage_amount;
    
    // 4. Verify new health is max(0, health_after_damage)
    component is_negative = LessThan(32);
    is_negative.in[0] <== health_after_damage;
    is_negative.in[1] <== 0;
    
    // If negative, new_health should be 0, otherwise health_after_damage
    signal expected_new_health <== is_negative.out * 0 + 
                                   (1 - is_negative.out) * health_after_damage;
    
    component new_health_check = IsEqual();
    new_health_check.in[0] <== new_health;
    new_health_check.in[1] <== expected_new_health;
    
    // 5. Verify new health commitment
    component new_poseidon = Poseidon(2);
    new_poseidon.inputs[0] <== new_health;
    new_poseidon.inputs[1] <== new_salt;
    
    component new_check = IsEqual();
    new_check.in[0] <== new_poseidon.out;
    new_check.in[1] <== new_health_commitment;
    
    // 6. Determine death status
    component death_check = IsZero();
    death_check.in <== new_health;
    is_dead <== death_check.out;
    
    // All checks must pass
    is_valid <== old_check.out * old_health_min.out * old_health_max.out *
                 new_health_check.out * new_check.out;
}

component main = Damage();
