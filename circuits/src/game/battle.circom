pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/mux1.circom";

// Advanced Battle Circuit (Etherion Rules)
// Inputs:
// - attackerATK: Attack points of attacking monster
// - defenderATK: Attack points of defending monster (if in ATK pos)
// - defenderDEF: Defense points of defending monster (if in DEF pos)
// - defenderPos: 0 = Attack, 1 = Defense

// Outputs:
// - destroyAttacker: 1 if attacker is destroyed
// - destroyDefender: 1 if defender is destroyed
// - damageToAttacker: LP damage to attacker
// - damageToDefender: LP damage to defender

template Battle() {
    signal input attackerATK;
    signal input defenderATK;
    signal input defenderDEF;
    signal input defenderPos; // 0: ATK, 1: DEF

    signal output destroyAttacker;
    signal output destroyDefender;
    signal output damageToAttacker;
    signal output damageToDefender;

    // --- Components ---
    component gtATK = GreaterThan(32);
    component ltATK = LessThan(32);
    component eqATK = IsEqual();
    
    component gtDEF = GreaterThan(32); // Atk > Def
    component ltDEF = LessThan(32);    // Atk < Def
    component eqDEF = IsEqual();       // Atk == Def

    // 1. Calculations for Attack vs Attack (Pos == 0)
    // -----------------------------------------------
    gtATK.in[0] <== attackerATK;
    gtATK.in[1] <== defenderATK;
    ltATK.in[0] <== attackerATK;
    ltATK.in[1] <== defenderATK;
    eqATK.in[0] <== attackerATK;
    eqATK.in[1] <== defenderATK;

    // A wins: destroy D, D takes (A - D)
    // D wins: destroy A, A takes (D - A)
    // Tie: destroy BOTH, 0 damage

    signal damageAvA_Def <== (attackerATK - defenderATK);
    signal damageAvA_Atk <== (defenderATK - attackerATK);

    signal destDef_AvA <== gtATK.out + eqATK.out; // Destroy if < or = (Logic: Higher destroys lower. Equal=Both. So if A >= D, D dies)
    signal destAtk_AvA <== ltATK.out + eqATK.out; // If A <= D, A dies

    signal dmgToDef_AvA <== damageAvA_Def * gtATK.out; // Only if A > D
    signal dmgToAtk_AvA <== damageAvA_Atk * ltATK.out; // Only if A < D

    // 2. Calculations for Attack vs Defense (Pos == 1)
    // ------------------------------------------------
    gtDEF.in[0] <== attackerATK;
    gtDEF.in[1] <== defenderDEF;
    ltDEF.in[0] <== attackerATK;
    ltDEF.in[1] <== defenderDEF;
    eqDEF.in[0] <== attackerATK;
    eqDEF.in[1] <== defenderDEF;

    // Rules:
    // A > D: Def destroyed, 0 damage.
    // A < D: Atk destroyed, Atk takes (D - A) damage.
    // A = D: Def destroyed (User Rule), 0 damage.

    signal damageAvD_Atk <== (defenderDEF - attackerATK);

    signal destDef_AvD <== gtDEF.out + eqDEF.out; // Destroy if A >= D
    signal destAtk_AvD <== ltDEF.out; // Destroy if A < D

    signal dmgToDef_AvD <== 0; // Never take damage in DEF
    signal dmgToAtk_AvD <== damageAvD_Atk * ltDEF.out;

    // 3. Selection Mux (Based on defenderPos)
    // ---------------------------------------
    // Mux1 select: if s=0 choose c[0], if s=1 choose c[1]

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
