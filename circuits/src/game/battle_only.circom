pragma circom 2.0.0;

include "battle.circom";

// Standalone Battle Circuit for efficient proof generation
// Use this when only validating battle outcomes

component main {public [attackerATK, defenderATK, defenderDEF, defenderPos]} = Battle();
