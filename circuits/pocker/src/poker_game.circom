pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "./hand_ranking.circom";

/**
 * Complete Poker Game Circuit
 * 
 * Main circuit that combines commitment, reveal, and ranking
 * Used for the full game flow
 * 
 * Public Inputs:
 *   - player1Commitment: Player 1's hand commitment
 *   - player2Commitment: Player 2's hand commitment
 *   - player1Cards[5]: Player 1's revealed cards
 *   - player2Cards[5]: Player 2's revealed cards
 * 
 * Private Inputs:
 *   - player1Salt: Player 1's commitment salt
 *   - player2Salt: Player 2's commitment salt
 * 
 * Public Outputs:
 *   - player1Ranking: Player 1's hand ranking
 *   - player2Ranking: Player 2's hand ranking
 *   - winner: 1 if player1 wins, 2 if player2 wins, 0 if tie
 */
template PokerGame() {
    // Public inputs
    signal input player1Commitment;
    signal input player2Commitment;
    signal input player1Cards[5];
    signal input player2Cards[5];
    
    // Private inputs
    signal input player1Salt;
    signal input player2Salt;
    
    // Public outputs
    signal output player1Ranking;
    signal output player2Ranking;
    signal output winner;
    
    // Verify Player 1's commitment
    component p1Hasher = Poseidon(6);
    for (var i = 0; i < 5; i++) {
        p1Hasher.inputs[i] <== player1Cards[i];
    }
    p1Hasher.inputs[5] <== player1Salt;
    signal p1Match;
    p1Match <== p1Hasher.out - player1Commitment;
    p1Match === 0;
    
    // Verify Player 2's commitment
    component p2Hasher = Poseidon(6);
    for (var i = 0; i < 5; i++) {
        p2Hasher.inputs[i] <== player2Cards[i];
    }
    p2Hasher.inputs[5] <== player2Salt;
    signal p2Match;
    p2Match <== p2Hasher.out - player2Commitment;
    p2Match === 0;
    
    // Rank both hands
    component p1Ranking = HandRanking();
    for (var i = 0; i < 5; i++) {
        p1Ranking.cards[i] <== player1Cards[i];
    }
    player1Ranking <== p1Ranking.ranking;
    
    component p2Ranking = HandRanking();
    for (var i = 0; i < 5; i++) {
        p2Ranking.cards[i] <== player2Cards[i];
    }
    player2Ranking <== p2Ranking.ranking;
    
    // Determine winner
    signal rankDiff;
    rankDiff <== player1Ranking - player2Ranking;
    
    // If rankDiff > 0, player 1 wins
    // If rankDiff < 0, player 2 wins
    // If rankDiff == 0, check high card
    component isPositive = GreaterThan(8);
    isPositive.in[0] <== player1Ranking;
    isPositive.in[1] <== player2Ranking;
    signal p1Wins;
    p1Wins <== isPositive.out;
    
    component isNegative = LessThan(8);
    isNegative.in[0] <== player1Ranking;
    isNegative.in[1] <== player2Ranking;
    signal p2Wins;
    p2Wins <== isNegative.out;
    
    // If tie on ranking, compare high cards
    signal isTie;
    isTie <== 1 - p1Wins - p2Wins;
    
    signal highCardDiff;
    highCardDiff <== p1Ranking.highCard - p2Ranking.highCard;
    
    component highCardPositive = GreaterThan(8);
    highCardPositive.in[0] <== p1Ranking.highCard;
    highCardPositive.in[1] <== p2Ranking.highCard;
    
    component highCardNegative = LessThan(8);
    highCardNegative.in[0] <== p1Ranking.highCard;
    highCardNegative.in[1] <== p2Ranking.highCard;
    
    signal p1WinsHighCard;
    signal p2WinsHighCard;
    p1WinsHighCard <== isTie * highCardPositive.out;
    p2WinsHighCard <== isTie * highCardNegative.out;
    
    // Final winner: 1 = player1, 2 = player2, 0 = tie
    winner <== (p1Wins + p1WinsHighCard) * 1 + (p2Wins + p2WinsHighCard) * 2;
}

component main {public [player1Commitment, player2Commitment, player1Cards, player2Cards]} = PokerGame();
