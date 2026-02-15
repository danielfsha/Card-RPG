pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/mux1.circom";

// Advanced Battle Circuit (Yu-Gi-Oh! style rules)
// Inputs:
// - attackerATK: Attack points of attacking monster
// - defenderATK: Attack points of defending monster (if in ATK pos)
// - defenderDEF: Defense points of defending monster (if in DEF pos)
// - defenderPos: 0 = Attack Position, 1 = Defense Position

// Outputs:
// - destroyAttacker: 1 if attacker is destroyed
// - destroyDefender: 1 if defender is destroyed
// - damageToAttacker: LP damage to attacking player
// - damageToDefender: LP damage to defending player

template Battle() {
    signal input attackerATK;
    signal input defenderATK;
    signal input defenderDEF;
    signal input defenderPos; // 0: ATK, 1: DEF

    signal output destroyAttacker;
    signal output destroyDefender;
    signal output damageToAttacker;
    signal output damageToDefender;

    // Constrain defenderPos to be binary
    defenderPos * (1 - defenderPos) === 0;

    // --- Attack vs Attack Position (defenderPos == 0) ---
    component gtATK = GreaterThan(16);
    component ltATK = LessThan(16);
    component eqATK = IsEqual();
    
    gtATK.in[0] <== attackerATK;
    gtATK.in[1] <== defenderATK;
    ltATK.in[0] <== attackerATK;
    ltATK.in[1] <== defenderATK;
    eqATK.in[0] <== attackerATK;
    eqATK.in[1] <== defenderATK;

    // Calculate damage differences
    signal damageAvA_Def <== attackerATK - defenderATK;
    signal damageAvA_Atk <== defenderATK - attackerATK;

    // Destruction logic for ATK vs ATK
    signal destDef_AvA <== gtATK.out + eqATK.out; // Defender destroyed if ATK >= DEF
    signal destAtk_AvA <== ltATK.out + eqATK.out; // Attacker destroyed if ATK <= DEF

    // Damage logic for ATK vs ATK
    signal dmgToDef_AvA <== damageAvA_Def * gtATK.out; // Only if attacker wins
    signal dmgToAtk_AvA <== damageAvA_Atk * ltATK.out; // Only if defender wins

    // --- Attack vs Defense Position (defenderPos == 1) ---
    component gtDEF = GreaterThan(16);
    component ltDEF = LessThan(16);
    component eqDEF = IsEqual();
    
    gtDEF.in[0] <== attackerATK;
    gtDEF.in[1] <== defenderDEF;
    ltDEF.in[0] <== attackerATK;
    ltDEF.in[1] <== defenderDEF;
    eqDEF.in[0] <== attackerATK;
    eqDEF.in[1] <== defenderDEF;

    // Calculate damage for ATK vs DEF
    signal damageAvD_Atk <== defenderDEF - attackerATK;

    // Destruction logic for ATK vs DEF
    signal destDef_AvD <== gtDEF.out + eqDEF.out; // Defender destroyed if ATK >= DEF
    signal destAtk_AvD <== ltDEF.out; // Attacker destroyed if ATK < DEF

    // Damage logic for ATK vs DEF
    signal dmgToDef_AvD <== 0; // Defender never takes damage in DEF position
    signal dmgToAtk_AvD <== damageAvD_Atk * ltDEF.out; // Attacker takes damage if loses

    // --- Select outputs based on defenderPos ---
    component muxDestAtk = Mux1();
    muxDestAtk.s <== defenderPos;
    muxDestAtk.c[0] <== destAtk_AvA;
    muxDestAtk.c[1] <== destAtk_AvD;
    destroyAttacker <== muxDestAtk.out;

    component muxDestDef = Mux1();
    muxDestDef.s <== defenderPos;
    muxDestDef.c[0] <== destDef_AvA;
    muxDestDef.c[1] <== destDef_AvD;
    destroyDefender <== muxDestDef.out;

    component muxDmgAtk = Mux1();
    muxDmgAtk.s <== defenderPos;
    muxDmgAtk.c[0] <== dmgToAtk_AvA;
    muxDmgAtk.c[1] <== dmgToAtk_AvD;
    damageToAttacker <== muxDmgAtk.out;

    component muxDmgDef = Mux1();
    muxDmgDef.s <== defenderPos;
    muxDmgDef.c[0] <== dmgToDef_AvA;
    muxDmgDef.c[1] <== dmgToDef_AvD;
    damageToDefender <== muxDmgDef.out;
}
