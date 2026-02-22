// Shared utilities for fog of war chess circuits

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

// Extract piece type from square value
pub fn get_piece_type(square: u8) -> u8 {
    square & 0x0F
}

// Extract piece color from square value
pub fn get_piece_color(square: u8) -> u8 {
    (square >> 4) & 0x01
}

// Encode piece type and color into square value
pub fn encode_piece(piece_type: u8, color: u8) -> u8 {
    piece_type | (color << 4)
}

// Convert square index to algebraic notation (for debugging)
pub fn square_to_coords(square: u8) -> (u8, u8) {
    (square / 8, square % 8)
}

// Convert algebraic notation to square index
pub fn coords_to_square(row: u8, col: u8) -> u8 {
    row * 8 + col
}
