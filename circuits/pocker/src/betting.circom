pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/comparators.circom";

// Betting Validation Circuit
// Validates that a betting action meets game rules
template BettingValidation() {
    signal input bet_amount;
    signal input player_stack;
    signal input min_bet;
    signal input current_bet;
    signal input action_type;  // 0=fold, 1=check, 2=call, 3=bet, 4=raise, 5=allin
    
    signal output valid;
    
    // Check player has sufficient funds
    component hasEnough = GreaterEqThan(64);
    hasEnough.in[0] <== player_stack;
    hasEnough.in[1] <== bet_amount;
    
    // Check bet meets minimum
    component meetsMin = GreaterEqThan(64);
    meetsMin.in[0] <== bet_amount;
    meetsMin.in[1] <== min_bet;
    
    // Check raise is at least 2x current bet
    signal double_bet;
    double_bet <== current_bet * 2;
    component validRaise = GreaterEqThan(64);
    validRaise.in[0] <== bet_amount;
    validRaise.in[1] <== double_bet;
    
    // Check if current bet is zero (for check validation)
    component isZeroBet = IsZero();
    isZeroBet.in <== current_bet;
    
    // Check if bet matches current bet (for call validation)
    component matchesBet = IsEqual();
    matchesBet.in[0] <== bet_amount;
    matchesBet.in[1] <== current_bet;
    
    // Check if bet equals stack (for all-in validation)
    component isAllIn = IsEqual();
    isAllIn.in[0] <== bet_amount;
    isAllIn.in[1] <== player_stack;
    
    // Validate based on action type using IsEqual components
    // action_type: 0=fold, 1=check, 2=call, 3=bet, 4=raise, 5=allin
    
    component isFold = IsEqual();
    isFold.in[0] <== action_type;
    isFold.in[1] <== 0;
    
    component isCheck = IsEqual();
    isCheck.in[0] <== action_type;
    isCheck.in[1] <== 1;
    
    component isCall = IsEqual();
    isCall.in[0] <== action_type;
    isCall.in[1] <== 2;
    
    component isBet = IsEqual();
    isBet.in[0] <== action_type;
    isBet.in[1] <== 3;
    
    component isRaise = IsEqual();
    isRaise.in[0] <== action_type;
    isRaise.in[1] <== 4;
    
    component isAllInAction = IsEqual();
    isAllInAction.in[0] <== action_type;
    isAllInAction.in[1] <== 5;
    
    // Calculate validity for each action type
    signal foldValid;
    foldValid <== isFold.out * 1;  // Fold always valid
    
    signal checkValid;
    checkValid <== isCheck.out * isZeroBet.out;  // Check only if no bet
    
    signal callValid;
    callValid <== isCall.out * matchesBet.out;  // Call matches bet
    
    signal betValid;
    betValid <== isBet.out * meetsMin.out;  // Bet meets minimum
    
    signal raiseValid;
    raiseValid <== isRaise.out * validRaise.out;  // Raise is 2x+
    
    signal allInValid;
    allInValid <== isAllInAction.out * isAllIn.out;  // All-in equals stack
    
    // Combine all validations
    signal action_valid;
    action_valid <== foldValid + checkValid + callValid + betValid + raiseValid + allInValid;
    
    // Final validation: action is valid AND player has enough funds
    valid <== action_valid * hasEnough.out;
}

component main {public [min_bet, current_bet, action_type]} = BettingValidation();
