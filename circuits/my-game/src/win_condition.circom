pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/comparators.circom";

// Prove win condition is met
template WinCondition() {
    signal input player1LP;
    signal input player2LP;
    signal input player1DeckSize;
    signal input player2DeckSize;
    
    signal output winner;  // 1 = player1, 2 = player2, 0 = no winner
    signal output winReason;  // 0 = LP, 1 = deck out
    
    // Check LP win conditions
    component p1LPZero = IsZero();
    p1LPZero.in <== player1LP;
    
    component p2LPZero = IsZero();
    p2LPZero.in <== player2LP;
    
    // Check deck out conditions
    component p1DeckOut = IsZero();
    p1DeckOut.in <== player1DeckSize;
    
    component p2DeckOut = IsZero();
    p2DeckOut.in <== player2DeckSize;
    
    // Determine winner
    signal p1Wins;
    signal p2Wins;
    
    p1Wins <== p2LPZero.out + p2DeckOut.out;
    p2Wins <== p1LPZero.out + p1DeckOut.out;
    
    winner <== p1Wins * 1 + p2Wins * 2;
    
    // Determine win reason
    signal lpWin;
    lpWin <== p1LPZero.out + p2LPZero.out;
    winReason <== 1 - lpWin;  // 0 if LP win, 1 if deck out
}

component main {public [player1LP, player2LP, player1DeckSize, player2DeckSize]} = WinCondition();
