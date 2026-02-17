pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

template HandRanking() {
    signal input cards[5];
    signal output ranking;
    signal output highCard;
    
    signal ranks[5];
    signal suits[5];
    
    for (var i = 0; i < 5; i++) {
        ranks[i] <-- cards[i] % 13;
        suits[i] <-- cards[i] \ 13;
        
        signal rankCheck;
        rankCheck <== suits[i] * 13 + ranks[i];
        rankCheck === cards[i];
    }
    
    component flushChecks[4];
    signal flushAcc[4];
    
    for (var i = 0; i < 4; i++) {
        flushChecks[i] = IsEqual();
        flushChecks[i].in[0] <== suits[i];
        flushChecks[i].in[1] <== suits[i+1];
        if (i == 0) {
            flushAcc[i] <== flushChecks[i].out;
        } else {
            flushAcc[i] <== flushAcc[i-1] * flushChecks[i].out;
        }
    }
    
    signal isFlush;
    isFlush <== flushAcc[3];
    
    ranking <== isFlush * 5;
    
    highCard <== ranks[4];
}

component main {public [cards]} = HandRanking();
