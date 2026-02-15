pragma circom 2.0.0;

include "draw.circom";

// Standalone Draw Circuit for efficient proof generation
// Use this when only validating card draws without battle

component main {public [deckRoot, currentSuitsMask, cardIndex]} = DrawCard(6);
