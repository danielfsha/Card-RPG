pragma circom 2.0.0;

include "battle.circom";
include "draw.circom";
include "../utils/merkle.circom";
include "../utils/commitment.circom";

// Main ZK Card RPG Circuit
// Combines draw validation and battle resolution
template CardRPGZK(MERKLE_DEPTH) {
    // Draw Phase Inputs
    signal input deckRoot;
    signal input currentSuitsMask;
    signal input cardIndex;
    signal input cardValue;
    signal input pathElements[MERKLE_DEPTH];
    signal input pathIndices[MERKLE_DEPTH];
    
    // Battle Phase Inputs
    signal input attackerATK;
    signal input defenderATK;
    signal input defenderDEF;
    signal input defenderPos;
    
    // Outputs
    signal output newSuitsMask;
    signal output isBust;
    signal output drawnSuit;
    signal output destroyAttacker;
    signal output destroyDefender;
    signal output damageToAttacker;
    signal output damageToDefender;

    // Draw Card Proof
    component draw = DrawCard(MERKLE_DEPTH);
    draw.deckRoot <== deckRoot;
    draw.currentSuitsMask <== currentSuitsMask;
    draw.cardIndex <== cardIndex;
    draw.cardValue <== cardValue;
    for (var i = 0; i < MERKLE_DEPTH; i++) {
        draw.pathElements[i] <== pathElements[i];
        draw.pathIndices[i] <== pathIndices[i];
    }
    newSuitsMask <== draw.newSuitsMask;
    isBust <== draw.isBust;
    drawnSuit <== draw.drawnSuit;

    // Battle Proof
    component battle = Battle();
    battle.attackerATK <== attackerATK;
    battle.defenderATK <== defenderATK;
    battle.defenderDEF <== defenderDEF;
    battle.defenderPos <== defenderPos;
    destroyAttacker <== battle.destroyAttacker;
    destroyDefender <== battle.destroyDefender;
    damageToAttacker <== battle.damageToAttacker;
    damageToDefender <== battle.damageToDefender;
}

// Separate circuits for different game actions
// This allows for more efficient proof generation

// Circuit for just drawing a card
template DrawOnly(MERKLE_DEPTH) {
    signal input deckRoot;
    signal input currentSuitsMask;
    signal input cardIndex;
    signal input cardValue;
    signal input pathElements[MERKLE_DEPTH];
    signal input pathIndices[MERKLE_DEPTH];
    
    signal output newSuitsMask;
    signal output isBust;
    signal output drawnSuit;

    component draw = DrawCard(MERKLE_DEPTH);
    draw.deckRoot <== deckRoot;
    draw.currentSuitsMask <== currentSuitsMask;
    draw.cardIndex <== cardIndex;
    draw.cardValue <== cardValue;
    for (var i = 0; i < MERKLE_DEPTH; i++) {
        draw.pathElements[i] <== pathElements[i];
        draw.pathIndices[i] <== pathIndices[i];
    }
    newSuitsMask <== draw.newSuitsMask;
    isBust <== draw.isBust;
    drawnSuit <== draw.drawnSuit;
}

// Circuit for just battle resolution
template BattleOnly() {
    signal input attackerATK;
    signal input defenderATK;
    signal input defenderDEF;
    signal input defenderPos;
    
    signal output destroyAttacker;
    signal output destroyDefender;
    signal output damageToAttacker;
    signal output damageToDefender;

    component battle = Battle();
    battle.attackerATK <== attackerATK;
    battle.defenderATK <== defenderATK;
    battle.defenderDEF <== defenderDEF;
    battle.defenderPos <== defenderPos;
    destroyAttacker <== battle.destroyAttacker;
    destroyDefender <== battle.destroyDefender;
    damageToAttacker <== battle.damageToAttacker;
    damageToDefender <== battle.damageToDefender;
}

// Example instantiation for 40-card deck (6-level Merkle tree: 2^6 = 64 leaves)
component main {public [deckRoot, currentSuitsMask, cardIndex, attackerATK, defenderATK, defenderDEF, defenderPos]} = CardRPGZK(6);