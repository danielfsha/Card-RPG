pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

template PokerGame() {
    signal input player1Commitment;
    signal input player2Commitment;
    signal input player1Cards[5];
    signal input player2Cards[5];
    
    signal input player1Salt;
    signal input player2Salt;
    
    signal output player1Ranking;
    signal output player2Ranking;
    signal output winner;
    
    component p1Hasher = Poseidon(6);
    for (var i = 0; i < 5; i++) {
        p1Hasher.inputs[i] <== player1Cards[i];
    }
    p1Hasher.inputs[5] <== player1Salt;
    signal p1Match;
    p1Match <== p1Hasher.out - player1Commitment;
    p1Match === 0;
    
    component p2Hasher = Poseidon(6);
    for (var i = 0; i < 5; i++) {
        p2Hasher.inputs[i] <== player2Cards[i];
    }
    p2Hasher.inputs[5] <== player2Salt;
    signal p2Match;
    p2Match <== p2Hasher.out - player2Commitment;
    p2Match === 0;
    
    signal p1Ranks[5];
    signal p1Suits[5];
    signal p1Check[5];
    for (var i = 0; i < 5; i++) {
        p1Ranks[i] <-- player1Cards[i] % 13;
        p1Suits[i] <-- player1Cards[i] \ 13;
        p1Check[i] <== p1Suits[i] * 13 + p1Ranks[i];
        p1Check[i] === player1Cards[i];
    }
    
    signal p2Ranks[5];
    signal p2Suits[5];
    signal p2Check[5];
    for (var i = 0; i < 5; i++) {
        p2Ranks[i] <-- player2Cards[i] % 13;
        p2Suits[i] <-- player2Cards[i] \ 13;
        p2Check[i] <== p2Suits[i] * 13 + p2Ranks[i];
        p2Check[i] === player2Cards[i];
    }
    
    component p1FlushChecks[4];
    signal p1FlushAcc[4];
    for (var i = 0; i < 4; i++) {
        p1FlushChecks[i] = IsEqual();
        p1FlushChecks[i].in[0] <== p1Suits[i];
        p1FlushChecks[i].in[1] <== p1Suits[i+1];
        if (i == 0) {
            p1FlushAcc[i] <== p1FlushChecks[i].out;
        } else {
            p1FlushAcc[i] <== p1FlushAcc[i-1] * p1FlushChecks[i].out;
        }
    }
    signal p1IsFlush;
    p1IsFlush <== p1FlushAcc[3];
    player1Ranking <== p1IsFlush * 5;
    
    component p2FlushChecks[4];
    signal p2FlushAcc[4];
    for (var i = 0; i < 4; i++) {
        p2FlushChecks[i] = IsEqual();
        p2FlushChecks[i].in[0] <== p2Suits[i];
        p2FlushChecks[i].in[1] <== p2Suits[i+1];
        if (i == 0) {
            p2FlushAcc[i] <== p2FlushChecks[i].out;
        } else {
            p2FlushAcc[i] <== p2FlushAcc[i-1] * p2FlushChecks[i].out;
        }
    }
    signal p2IsFlush;
    p2IsFlush <== p2FlushAcc[3];
    player2Ranking <== p2IsFlush * 5;
    
    component isP1Greater = GreaterThan(8);
    isP1Greater.in[0] <== player1Ranking;
    isP1Greater.in[1] <== player2Ranking;
    signal p1Wins;
    p1Wins <== isP1Greater.out;
    
    component isP2Greater = GreaterThan(8);
    isP2Greater.in[0] <== player2Ranking;
    isP2Greater.in[1] <== player1Ranking;
    signal p2Wins;
    p2Wins <== isP2Greater.out;
    
    signal isTie;
    isTie <== 1 - p1Wins - p2Wins;
    
    component highCardComp = GreaterThan(8);
    highCardComp.in[0] <== p1Ranks[4];
    highCardComp.in[1] <== p2Ranks[4];
    signal p1WinsHighCard;
    p1WinsHighCard <== isTie * highCardComp.out;
    
    winner <== (p1Wins + p1WinsHighCard) * 1 + p2Wins * 2;
}

component main {public [player1Commitment, player2Commitment]} = PokerGame();
