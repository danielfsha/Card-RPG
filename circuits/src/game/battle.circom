pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/comparators.circom";

// Battle Resolution Circuit
// Verifies:
// 1. Calculation of Damage = |ATK - DEF|
// 2. Destruction logic (Winner is the one with higher stat)

template Battle() {
    signal input attackStat; // e.g. ATK of Player A
    signal input defenseStat; // e.g. DEF of Player B (or ATK if attack position)
    
    signal output damage;
    signal output destruction; // 1 if defender destroyed, 0 if survivor (or whatever rule)
    signal output attackerWins; // 1 if attacker > defender

    component gt = GreaterThan(32);
    gt.in[0] <== attackStat;
    gt.in[1] <== defenseStat;
    attackerWins <== gt.out;

    // If Attacker > Defender: Damage = ATK - DEF
    // If Defender > Attacker: Damage = DEF - ATK (Reflect damage?) 
    // Standard YGO: 
    // ATK > ATK(Def): Destroys Def, Dmg = diff to LP.
    // ATK < ATK(Def): Destroys Atk, Dmg = diff to LP.
    // ATK = ATK(Def): Both destroy.
    
    // For this generic circuit, let's output abs diff and winner.
    
    signal diff;
    diff <== attackStat - defenseStat;

    // Absolute difference
    // If attackerWins (ATK > DEF), diff is positive.
    // If !attackerWins (ATK <= DEF), diff is non-positive.
    
    // damage = attackerWins * diff - (1-attackerWins) * diff 
    //        = diff * (attackerWins - 1 + attackerWins)
    //        = diff * (2*attackerWins - 1)
    
    // Wait, if equal? GT is strict.
    // If equal, GT=0. diff=0. damage=0. Correct.
    
    damage <== (attackStat - defenseStat) * (2*gt.out - 1);
    
    destruction <== gt.out; 
}
