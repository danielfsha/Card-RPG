pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// Prove you're summoning a card that's actually in your hand
template CardSummon() {
    signal input handCommitment;      // Commitment of your current hand
    signal input summonedCardId;      // Card you're summoning
    signal input summonedCardATK;
    signal input summonedCardDEF;
    signal input summonPosition;      // 0 = ATK, 1 = DEF, 2 = DEF_DOWN
    signal input remainingHand[4];    // Your hand after summoning (max 5 cards)
    signal input handSize;            // Current hand size (1-5)
    signal input salt;
    
    signal output newHandCommitment;
    signal output summonedCardHash;
    
    // Verify hand size is valid (1-5)
    component sizeCheck = LessThan(8);
    sizeCheck.in[0] <== handSize;
    sizeCheck.in[1] <== 6;
    sizeCheck.out === 1;
    
    component sizeCheck2 = GreaterThan(8);
    sizeCheck2.in[0] <== handSize;
    sizeCheck2.in[1] <== 0;
    sizeCheck2.out === 1;
    
    // Verify position is valid (0, 1, or 2)
    component posCheck = LessThan(8);
    posCheck.in[0] <== summonPosition;
    posCheck.in[1] <== 3;
    posCheck.out === 1;
    
    // Reconstruct original hand commitment
    // Hand = [summonedCard, ...remainingHand]
    component handHasher = Poseidon(6);
    handHasher.inputs[0] <== summonedCardId;
    for (var i = 0; i < 4; i++) {
        handHasher.inputs[i + 1] <== remainingHand[i];
    }
    handHasher.inputs[5] <== salt;
    
    signal handMatch;
    handMatch <== handHasher.out - handCommitment;
    handMatch === 0;
    
    // Compute new hand commitment (without summoned card)
    component newHasher = Poseidon(5);
    for (var i = 0; i < 4; i++) {
        newHasher.inputs[i] <== remainingHand[i];
    }
    newHasher.inputs[4] <== salt;
    newHandCommitment <== newHasher.out;
    
    // Compute summoned card hash (includes position)
    component cardHasher = Poseidon(4);
    cardHasher.inputs[0] <== summonedCardId;
    cardHasher.inputs[1] <== summonedCardATK;
    cardHasher.inputs[2] <== summonedCardDEF;
    cardHasher.inputs[3] <== summonPosition;
    summonedCardHash <== cardHasher.out;
}

component main {public [handCommitment, summonPosition]} = CardSummon();
