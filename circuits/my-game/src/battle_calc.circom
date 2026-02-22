pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/comparators.circom";

// Prove battle damage calculation follows Yu-Gi-Oh rules
// Rules:
// - ATK vs ATK: Higher ATK destroys lower, difference = LP damage to loser
// - ATK vs DEF: If ATK > DEF, destroy defender (no LP damage)
//               If ATK < DEF, destroy attacker, difference = LP damage to attacker
//               If ATK = DEF, no destruction, no damage
// - ATK vs DEF_DOWN: Same as DEF, but if ATK < DEF, attacker takes LP damage
template BattleCalculation() {
    signal input attackerATK;
    signal input attackerDEF;
    signal input defenderATK;
    signal input defenderDEF;
    signal input defenderPosition;  // 0 = ATK, 1 = DEF, 2 = DEF_DOWN
    signal input attackerLP;
    signal input defenderLP;
    
    signal output newAttackerLP;
    signal output newDefenderLP;
    signal output attackerDestroyed;  // 0 or 1
    signal output defenderDestroyed;  // 0 or 1
    signal output damage;
    
    // Determine defender's battle value
    component isATKPosition = IsEqual();
    isATKPosition.in[0] <== defenderPosition;
    isATKPosition.in[1] <== 0;
    
    signal defenderValue;
    defenderValue <== isATKPosition.out * defenderATK + (1 - isATKPosition.out) * defenderDEF;
    
    // Compare ATK vs defender value
    component atkGreater = GreaterThan(16);
    atkGreater.in[0] <== attackerATK;
    atkGreater.in[1] <== defenderValue;
    
    component defGreater = GreaterThan(16);
    defGreater.in[0] <== defenderValue;
    defGreater.in[1] <== attackerATK;
    
    component isEqual = IsEqual();
    isEqual.in[0] <== attackerATK;
    isEqual.in[1] <== defenderValue;
    
    // Calculate damage amount
    signal rawDamage;
    rawDamage <== attackerATK - defenderValue;
    
    // Determine destruction
    // Attacker destroyed if: defGreater = 1
    attackerDestroyed <== defGreater.out;
    
    // Defender destroyed if: atkGreater = 1 OR (isEqual = 1 AND isATKPosition = 1)
    signal equalATKBattle;
    equalATKBattle <== isEqual.out * isATKPosition.out;
    defenderDestroyed <== atkGreater.out + equalATKBattle;
    
    // Calculate LP changes
    // If ATK position: damage to loser's LP
    // If DEF position: only attacker takes damage if ATK < DEF
    signal attackerDamage;
    signal defenderDamage;
    
    // Attacker takes damage if: defGreater = 1
    attackerDamage <== defGreater.out * (defenderValue - attackerATK);
    
    // Defender takes damage if: atkGreater = 1 AND isATKPosition = 1
    defenderDamage <== atkGreater.out * isATKPosition.out * (attackerATK - defenderValue);
    
    damage <== attackerDamage + defenderDamage;
    
    newAttackerLP <== attackerLP - attackerDamage;
    newDefenderLP <== defenderLP - defenderDamage;
}

component main {public [attackerATK, defenderATK, defenderDEF, defenderPosition]} = BattleCalculation();
