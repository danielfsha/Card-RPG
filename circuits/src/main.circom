pragma circom 2.0.0;

include "game/draw.circom";

// Main entry point for the Draw Phase circuit
// Deck size up to 64 cards (2^6)

component main {public [deckRoot, currentSuitsMask]} = DrawCard(6);
