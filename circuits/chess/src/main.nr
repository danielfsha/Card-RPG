// Fog of War Chess - ZK Circuits using Noir
// Proves valid chess moves without revealing piece positions to opponent

use dep::std;

// Chess piece types
global EMPTY: u8 = 0;
global PAWN: u8 = 1;
global KNIGHT: u8 = 2;
global BISHOP: u8 = 3;
global ROOK: u8 = 4;
global QUEEN: u8 = 5;
global KING: u8 = 6;

// Colors
global WHITE: u8 = 0;
global BLACK: u8 = 1;

// Board is 8x8 = 64 squares
// Each square stores: piece_type (3 bits) + color (1 bit) = 4 bits
// We'll use u8 for each square for simplicity

// Main circuit: Prove a valid chess move
fn main(
    // Private inputs (hidden from opponent)
    board_state: [u8; 64],        // Current board state
    from_square: u8,              // Source square (0-63)
    to_square: u8,                // Destination square (0-63)
    piece_type: u8,               // Type of piece being moved
    piece_color: u8,              // Color of piece
    salt: Field,                  // Random salt for commitment
    
    // Public inputs (visible to both players)
    pub board_commitment: Field,  // Commitment to board state
    pub move_hash: Field,         // Hash of the move
    pub is_capture: bool,         // Whether this move captures
    pub is_check: bool            // Whether this move gives check
) {
    // 1. Verify board commitment
    let computed_commitment = compute_board_commitment(board_state, salt);
    assert(computed_commitment == board_commitment);
    
    // 2. Verify piece at from_square matches claimed piece
    let from_piece = board_state[from_square];
    assert(get_piece_type(from_piece) == piece_type);
    assert(get_piece_color(from_piece) == piece_color);
    
    // 3. Verify move is legal for this piece type
    assert(is_valid_move(board_state, from_square, to_square, piece_type, piece_color));
    
    // 4. Verify capture flag is correct
    let to_piece = board_state[to_square];
    let actual_capture = get_piece_type(to_piece) != EMPTY;
    assert(actual_capture == is_capture);
    
    // 5. Compute move hash
    let computed_move_hash = std::hash::pedersen_hash([
        from_square as Field,
        to_square as Field,
        piece_type as Field
    ]);
    assert(computed_move_hash == move_hash);
}

// Compute Pedersen commitment to board state
fn compute_board_commitment(board: [u8; 64], salt: Field) -> Field {
    // Hash board in chunks to avoid input limits
    let mut chunk_hashes: [Field; 8] = [0; 8];
    
    for i in 0..8 {
        let mut chunk: [Field; 8] = [0; 8];
        for j in 0..8 {
            chunk[j] = board[i * 8 + j] as Field;
        }
        chunk_hashes[i] = std::hash::pedersen_hash(chunk);
    }
    
    // Final hash with salt
    let mut final_input: [Field; 9] = [0; 9];
    for i in 0..8 {
        final_input[i] = chunk_hashes[i];
    }
    final_input[8] = salt;
    
    std::hash::pedersen_hash(final_input)
}

// Extract piece type from square value
fn get_piece_type(square: u8) -> u8 {
    square & 0x0F  // Lower 4 bits
}

// Extract piece color from square value
fn get_piece_color(square: u8) -> u8 {
    (square >> 4) & 0x01  // 5th bit
}

// Encode piece type and color into square value
fn encode_piece(piece_type: u8, color: u8) -> u8 {
    piece_type | (color << 4)
}

// Check if move is valid for the piece type
fn is_valid_move(
    board: [u8; 64],
    from: u8,
    to: u8,
    piece_type: u8,
    color: u8
) -> bool {
    // Basic bounds check
    if from >= 64 || to >= 64 || from == to {
        return false;
    }
    
    let from_row = from / 8;
    let from_col = from % 8;
    let to_row = to / 8;
    let to_col = to % 8;
    
    let row_diff = if to_row > from_row { to_row - from_row } else { from_row - to_row };
    let col_diff = if to_col > from_col { to_col - from_col } else { from_col - to_col };
    
    // Check destination is not occupied by own piece
    let dest_piece = board[to];
    if get_piece_type(dest_piece) != EMPTY {
        if get_piece_color(dest_piece) == color {
            return false;  // Can't capture own piece
        }
    }
    
    // Validate move based on piece type
    if piece_type == PAWN {
        is_valid_pawn_move(from_row, from_col, to_row, to_col, color, board[to])
    } else if piece_type == KNIGHT {
        is_valid_knight_move(row_diff, col_diff)
    } else if piece_type == BISHOP {
        is_valid_bishop_move(board, from, to, row_diff, col_diff)
    } else if piece_type == ROOK {
        is_valid_rook_move(board, from, to, row_diff, col_diff)
    } else if piece_type == QUEEN {
        is_valid_queen_move(board, from, to, row_diff, col_diff)
    } else if piece_type == KING {
        is_valid_king_move(row_diff, col_diff)
    } else {
        false
    }
}

fn is_valid_pawn_move(from_row: u8, from_col: u8, to_row: u8, to_col: u8, color: u8, dest: u8) -> bool {
    let direction: u8 = if color == WHITE { 1 } else { 255 };  // 255 = -1 in u8
    let row_diff = if to_row > from_row { to_row - from_row } else { from_row - to_row };
    let col_diff = if to_col > from_col { to_col - from_col } else { from_col - to_col };
    
    // Forward move
    if col_diff == 0 {
        if row_diff == 1 {
            return get_piece_type(dest) == EMPTY;
        }
        // Double move from starting position
        if row_diff == 2 {
            let start_row = if color == WHITE { 1 } else { 6 };
            return from_row == start_row && get_piece_type(dest) == EMPTY;
        }
    }
    
    // Diagonal capture
    if row_diff == 1 && col_diff == 1 {
        return get_piece_type(dest) != EMPTY;
    }
    
    false
}

fn is_valid_knight_move(row_diff: u8, col_diff: u8) -> bool {
    (row_diff == 2 && col_diff == 1) || (row_diff == 1 && col_diff == 2)
}

fn is_valid_bishop_move(board: [u8; 64], from: u8, to: u8, row_diff: u8, col_diff: u8) -> bool {
    // Must move diagonally
    if row_diff != col_diff || row_diff == 0 {
        return false;
    }
    
    // Check path is clear
    is_path_clear_diagonal(board, from, to)
}

fn is_valid_rook_move(board: [u8; 64], from: u8, to: u8, row_diff: u8, col_diff: u8) -> bool {
    // Must move horizontally or vertically
    if (row_diff != 0 && col_diff != 0) || (row_diff == 0 && col_diff == 0) {
        return false;
    }
    
    // Check path is clear
    is_path_clear_straight(board, from, to)
}

fn is_valid_queen_move(board: [u8; 64], from: u8, to: u8, row_diff: u8, col_diff: u8) -> bool {
    // Queen moves like rook or bishop
    if row_diff == col_diff && row_diff > 0 {
        is_path_clear_diagonal(board, from, to)
    } else if (row_diff == 0 || col_diff == 0) && (row_diff > 0 || col_diff > 0) {
        is_path_clear_straight(board, from, to)
    } else {
        false
    }
}

fn is_valid_king_move(row_diff: u8, col_diff: u8) -> bool {
    row_diff <= 1 && col_diff <= 1 && (row_diff > 0 || col_diff > 0)
}

fn is_path_clear_diagonal(board: [u8; 64], from: u8, to: u8) -> bool {
    let from_row = from / 8;
    let from_col = from % 8;
    let to_row = to / 8;
    let to_col = to % 8;
    
    let row_step: u8 = if to_row > from_row { 1 } else { 255 };  // 255 = -1
    let col_step: u8 = if to_col > from_col { 1 } else { 255 };
    
    let mut current_row = from_row.wrapping_add(row_step);
    let mut current_col = from_col.wrapping_add(col_step);
    
    // Check up to 7 squares (max diagonal length)
    for _ in 0..7 {
        if current_row == to_row && current_col == to_col {
            return true;
        }
        
        let square = current_row * 8 + current_col;
        if get_piece_type(board[square]) != EMPTY {
            return false;
        }
        
        current_row = current_row.wrapping_add(row_step);
        current_col = current_col.wrapping_add(col_step);
    }
    
    true
}

fn is_path_clear_straight(board: [u8; 64], from: u8, to: u8) -> bool {
    let from_row = from / 8;
    let from_col = from % 8;
    let to_row = to / 8;
    let to_col = to % 8;
    
    let row_step: u8 = if to_row > from_row { 1 } else if to_row < from_row { 255 } else { 0 };
    let col_step: u8 = if to_col > from_col { 1 } else if to_col < from_col { 255 } else { 0 };
    
    let mut current_row = from_row.wrapping_add(row_step);
    let mut current_col = from_col.wrapping_add(col_step);
    
    // Check up to 7 squares (max straight length)
    for _ in 0..7 {
        if current_row == to_row && current_col == to_col {
            return true;
        }
        
        let square = current_row * 8 + current_col;
        if get_piece_type(board[square]) != EMPTY {
            return false;
        }
        
        current_row = current_row.wrapping_add(row_step);
        current_col = current_col.wrapping_add(col_step);
    }
    
    true
}

#[test]
fn test_board_commitment() {
    let mut board: [u8; 64] = [0; 64];
    // Set up initial position (simplified)
    board[0] = encode_piece(ROOK, WHITE);
    board[1] = encode_piece(KNIGHT, WHITE);
    board[7] = encode_piece(ROOK, WHITE);
    
    let salt: Field = 12345;
    let commitment = compute_board_commitment(board, salt);
    
    // Commitment should be deterministic
    let commitment2 = compute_board_commitment(board, salt);
    assert(commitment == commitment2);
}

#[test]
fn test_knight_move() {
    assert(is_valid_knight_move(2, 1));
    assert(is_valid_knight_move(1, 2));
    assert(!is_valid_knight_move(1, 1));
    assert(!is_valid_knight_move(2, 2));
}

#[test]
fn test_king_move() {
    assert(is_valid_king_move(1, 0));
    assert(is_valid_king_move(1, 1));
    assert(is_valid_king_move(0, 1));
    assert(!is_valid_king_move(2, 0));
    assert(!is_valid_king_move(0, 0));
}
