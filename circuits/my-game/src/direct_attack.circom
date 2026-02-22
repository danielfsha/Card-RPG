pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/comparators.circom";

// Prove a direct attack is legal (opponent has no monsters)
template DirectAttack() {
    signal input attackerATK;
    signal input opponentLP;
    signal input opponentFieldCount;  // Number of monsters opponent has
    
    signal output newOpponentLP;
    signal output isLegal;
    
    // Direct attack only legal if opponent has no monsters
    component noMonsters = IsZero();
    noMonsters.in <== opponentFieldCount;
    isLegal <== noMonsters.out;
    
    // Calculate new LP (only if legal)
    newOpponentLP <== opponentLP - (isLegal * attackerATK);
}

component main {public [attackerATK, opponentLP, opponentFieldCount]} = DirectAttack();
