pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "./utils/merkle.circom";

// Draw Card Circuit - Dead Man's Draw Rules
// Proves a card draw is valid and checks for bust condition
template DrawCard() {
    // Public inputs
    signal input deck_root;           // Merkle root of player's deck
    signal input card_index;          // Index of card being drawn
    signal input current_suits_mask;  // 4-bit mask of suits already drawn this turn
    
    // Private inputs
    signal input card_value;          // Card ID (0-39)
    signal input path_elements[6];    // Merkle proof
    signal input path_indices[6];     // Merkle path directions
    
    // Outputs
    signal output new_suits_mask;     // Updated suits mask
    signal output is_bust;            // 1 if bust, 0 if safe
    signal output card_suit;          // Suit of drawn card (0-3)
    signal output card_rank;          // Rank of drawn card (1-10)

    // 1. Verify card is in deck using Merkle proof
    component merkle = MerkleProof(6);
    merkle.leaf <== card_value;
    merkle.root <== deck_root;
    for (var i = 0; i < 6; i++) {
        merkle.pathElements[i] <== path_elements[i];
        merkle.pathIndices[i] <== path_indices[i];
    }

    // 2. Decode card: card_value = suit * 10 + rank_index
    //    suit: 0-3 (Swords, Coins, Cups, Wands)
    //    rank_index: 0-9 (represents ranks 1-10)
    
    // Extract suit (card_value / 10)
    signal suit_times_10;
    signal rank_idx;
    
    // card_value = suit * 10 + rank_idx
    // We need to constrain this properly
    
    // Use range checks to extract suit
    component suit_bits = Num2Bits(8);
    suit_bits.in <== card_value;
    
    // Suit is in bits 4-5 (since max card_value = 39 = 0b100111)
    // Actually, let's compute it properly:
    // suit = card_value \ 10 (integer division)
    // rank_idx = card_value % 10
    
    // For circuit efficiency, we'll verify the decomposition
    component rank_bits = Num2Bits(4);
    
    // Constrain card_value < 40
    component lt40 = LessThan(8);
    lt40.in[0] <== card_value;
    lt40.in[1] <== 40;
    lt40.out === 1;
    
    // Compute suit and rank
    // suit = 0: cards 0-9
    // suit = 1: cards 10-19
    // suit = 2: cards 20-29
    // suit = 3: cards 30-39
    
    signal suit_candidates[4];
    component suit_eq[4];
    
    for (var s = 0; s < 4; s++) {
        suit_eq[s] = IsEqual();
        
        // Check if card_value is in range [s*10, s*10+9]
        component ge = GreaterEqThan(8);
        ge.in[0] <== card_value;
        ge.in[1] <== s * 10;
        
        component lt = LessThan(8);
        lt.in[0] <== card_value;
        lt.in[1] <== (s + 1) * 10;
        
        suit_candidates[s] <== ge.out * lt.out;
    }
    
    // Exactly one suit must match
    signal suit_sum[5];
    suit_sum[0] <== 0;
    for (var s = 0; s < 4; s++) {
        suit_sum[s + 1] <== suit_sum[s] + suit_candidates[s];
    }
    suit_sum[4] === 1;
    
    // Compute actual suit
    signal suit_value[4];
    suit_value[0] <== 0 * suit_candidates[0];
    for (var s = 1; s < 4; s++) {
        suit_value[s] <== suit_value[s - 1] + s * suit_candidates[s];
    }
    card_suit <== suit_value[3];
    
    // Compute rank (1-10)
    // rank_idx = card_value - suit * 10
    signal suit_offset <== card_suit * 10;
    rank_idx <== card_value - suit_offset;
    
    // Constrain rank_idx in [0, 9]
    component rank_range = LessThan(4);
    rank_range.in[0] <== rank_idx;
    rank_range.in[1] <== 10;
    rank_range.out === 1;
    
    card_rank <== rank_idx + 1;  // Rank is 1-10

    // 3. Check for bust (suit already in mask)
    // current_suits_mask is a 4-bit value
    // Bit 0 = Swords, Bit 1 = Coins, Bit 2 = Cups, Bit 3 = Wands
    
    component mask_bits = Num2Bits(4);
    mask_bits.in <== current_suits_mask;
    
    // Check if bit for this suit is already set
    signal suit_bit_set[4];
    component suit_check[4];
    
    for (var s = 0; s < 4; s++) {
        suit_check[s] = IsEqual();
        suit_check[s].in[0] <== card_suit;
        suit_check[s].in[1] <== s;
        
        // If this is our suit and bit is set, it's a bust
        suit_bit_set[s] <== suit_check[s].out * mask_bits.out[s];
    }
    
    // Sum to get bust flag
    signal bust_sum[5];
    bust_sum[0] <== 0;
    for (var s = 0; s < 4; s++) {
        bust_sum[s + 1] <== bust_sum[s] + suit_bit_set[s];
    }
    is_bust <== bust_sum[4];

    // 4. Compute new suits mask (set bit for this suit)
    signal new_mask_bits[4];
    
    for (var s = 0; s < 4; s++) {
        suit_check[s] = IsEqual();
        suit_check[s].in[0] <== card_suit;
        suit_check[s].in[1] <== s;
        
        // OR operation: new_bit = old_bit | (suit == s)
        new_mask_bits[s] <== mask_bits.out[s] + suit_check[s].out - (mask_bits.out[s] * suit_check[s].out);
    }
    
    component new_mask = Bits2Num(4);
    for (var s = 0; s < 4; s++) {
        new_mask.in[s] <== new_mask_bits[s];
    }
    new_suits_mask <== new_mask.out;
}

component main {public [deck_root, card_index, current_suits_mask]} = DrawCard();
