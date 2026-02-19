pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";

/**
 * Win Condition Circuit - Determines game winner
 * 
 * Ensures:
 * - Kill/death counts are valid
 * - Health values are valid
 * - Winner is correctly determined
 * - Stats commitment is valid
 */
template WinCondition() {
    // Public inputs
    signal input stats_commitment;
    signal input game_duration;
    
    // Private inputs - Player 1
    signal input player1_kills;
    signal input player1_deaths;
    signal input player1_health;
    signal input player1_shots_fired;
    signal input player1_shots_hit;
    
    // Private inputs - Player 2
    signal input player2_kills;
    signal input player2_deaths;
    signal input player2_health;
    signal input player2_shots_fired;
    signal input player2_shots_hit;
    
    // Private input - salt
    signal input salt;
    
    // Outputs
    signal output winner;  // 1 = player1, 2 = player2, 0 = tie
    signal output is_valid;
    
    // 1. Verify stats commitment
    component poseidon = Poseidon(11);
    poseidon.inputs[0] <== player1_kills;
    poseidon.inputs[1] <== player1_deaths;
    poseidon.inputs[2] <== player1_health;
    poseidon.inputs[3] <== player1_shots_fired;
    poseidon.inputs[4] <== player1_shots_hit;
    poseidon.inputs[5] <== player2_kills;
    poseidon.inputs[6] <== player2_deaths;
    poseidon.inputs[7] <== player2_health;
    poseidon.inputs[8] <== player2_shots_fired;
    poseidon.inputs[9] <== player2_shots_hit;
    poseidon.inputs[10] <== salt;
    
    component commitment_check = IsEqual();
    commitment_check.in[0] <== poseidon.out;
    commitment_check.in[1] <== stats_commitment;
    
    // 2. Verify kill/death consistency
    // Total kills should equal total deaths
    component kills_deaths_check = IsEqual();
    kills_deaths_check.in[0] <== player1_kills + player2_kills;
    kills_deaths_check.in[1] <== player1_deaths + player2_deaths;
    
    // 3. Verify health values are valid (0-100)
    component p1_health_min = GreaterEqThan(32);
    p1_health_min.in[0] <== player1_health;
    p1_health_min.in[1] <== 0;
    
    component p1_health_max = LessEqThan(32);
    p1_health_max.in[0] <== player1_health;
    p1_health_max.in[1] <== 100;
    
    component p2_health_min = GreaterEqThan(32);
    p2_health_min.in[0] <== player2_health;
    p2_health_min.in[1] <== 0;
    
    component p2_health_max = LessEqThan(32);
    p2_health_max.in[0] <== player2_health;
    p2_health_max.in[1] <== 100;
    
    // 4. Determine winner based on kills
    component p1_more_kills = GreaterThan(32);
    p1_more_kills.in[0] <== player1_kills;
    p1_more_kills.in[1] <== player2_kills;
    
    component p2_more_kills = GreaterThan(32);
    p2_more_kills.in[0] <== player2_kills;
    p2_more_kills.in[1] <== player1_kills;
    
    component equal_kills = IsEqual();
    equal_kills.in[0] <== player1_kills;
    equal_kills.in[1] <== player2_kills;
    
    // If equal kills, check who's alive
    component p1_alive = IsZero();
    p1_alive.in <== player1_health;
    signal p1_dead <== p1_alive.out;
    
    component p2_alive = IsZero();
    p2_alive.in <== player2_health;
    signal p2_dead <== p2_alive.out;
    
    // Tiebreaker: if equal kills, survivor wins
    signal tie_p1_wins <== equal_kills.out * (1 - p1_dead) * p2_dead;
    signal tie_p2_wins <== equal_kills.out * p1_dead * (1 - p2_dead);
    signal true_tie <== equal_kills.out * (1 - p1_dead) * (1 - p2_dead);
    
    // Final winner determination
    signal p1_wins <== p1_more_kills.out + tie_p1_wins;
    signal p2_wins <== p2_more_kills.out + tie_p2_wins;
    
    winner <== p1_wins * 1 + p2_wins * 2 + true_tie * 0;
    
    // All checks must pass
    is_valid <== commitment_check.out * kills_deaths_check.out *
                 p1_health_min.out * p1_health_max.out *
                 p2_health_min.out * p2_health_max.out;
}

component main = WinCondition();
