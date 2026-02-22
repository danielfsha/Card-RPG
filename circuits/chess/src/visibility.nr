// Fog of War - Visibility Circuit
// Proves which squares are visible to a player without revealing hidden pieces

use dep::std;

// Prove which squares are visible to a player
// In fog of war chess, you can see:
// 1. Your own pieces
// 2. Squares your pieces can move to or attack
// 3. Enemy pieces that are in your line of sight

pub fn compute_visibility_mask(
    board: [u8; 64],
    player_color: u8
) -> [bool; 64] {
    let mut visible: [bool; 64] = [false; 64];
    
    // Mark all squares with player's pieces as visible
    for i in 0..64 {
        let piece = board[i];
        if crate::get_piece_type(piece) != crate::EMPTY {
            if crate::get_piece_color(piece) == player_color {
                visible[i] = true;
                
                // Mark squares this piece can see
                mark_piece_vision(board, i, player_color, &mut visible);
            }
        }
    }
    
    visible
}

// Mark all squares a piece can see (move to or attack)
fn mark_piece_vision(
    board: [u8; 64],
    square: u8,
    color: u8,
    visible: &mut [bool; 64]
) {
    let piece = board[square];
    let piece_type = crate::get_piece_type(piece);
    
    if piece_type == crate::PAWN {
        mark_pawn_vision(square, color, visible);
    } else if piece_type == crate::KNIGHT {
        mark_knight_vision(square, visible);
    } else if piece_type == crate::BISHOP {
        mark_sliding_vision(board, square, true, false, visible);
    } else if piece_type == crate::ROOK {
        mark_sliding_vision(board, square, false, true, visible);
    } else if piece_type == crate::QUEEN {
        mark_sliding_vision(board, square, true, true, visible);
    } else if piece_type == crate::KING {
        mark_king_vision(square, visible);
    }
}

fn mark_pawn_vision(square: u8, color: u8, visible: &mut [bool; 64]) {
    let row = square / 8;
    let col = square % 8;
    
    let forward: u8 = if color == crate::WHITE { 1 } else { 255 };
    let new_row = row.wrapping_add(forward);
    
    if new_row < 8 {
        // Forward square
        if col < 8 {
            visible[new_row * 8 + col] = true;
        }
        
        // Diagonal attacks
        if col > 0 {
            visible[new_row * 8 + col - 1] = true;
        }
        if col < 7 {
            visible[new_row * 8 + col + 1] = true;
        }
    }
}

fn mark_knight_vision(square: u8, visible: &mut [bool; 64]) {
    let row = square / 8;
    let col = square % 8;
    
    let moves: [(i8, i8); 8] = [
        (2, 1), (2, -1), (-2, 1), (-2, -1),
        (1, 2), (1, -2), (-1, 2), (-1, -2)
    ];
    
    for i in 0..8 {
        let new_row = (row as i8) + moves[i].0;
        let new_col = (col as i8) + moves[i].1;
        
        if new_row >= 0 && new_row < 8 && new_col >= 0 && new_col < 8 {
            let target = (new_row as u8) * 8 + (new_col as u8);
            visible[target] = true;
        }
    }
}

fn mark_king_vision(square: u8, visible: &mut [bool; 64]) {
    let row = square / 8;
    let col = square % 8;
    
    for dr in 0..3 {
        for dc in 0..3 {
            if dr == 1 && dc == 1 {
                continue;  // Skip center
            }
            
            let new_row = row.wrapping_add(dr).wrapping_sub(1);
            let new_col = col.wrapping_add(dc).wrapping_sub(1);
            
            if new_row < 8 && new_col < 8 {
                visible[new_row * 8 + new_col] = true;
            }
        }
    }
}

fn mark_sliding_vision(
    board: [u8; 64],
    square: u8,
    diagonal: bool,
    straight: bool,
    visible: &mut [bool; 64]
) {
    let row = square / 8;
    let col = square % 8;
    
    let mut directions: [(i8, i8); 8] = [(0, 0); 8];
    let mut dir_count = 0;
    
    if straight {
        directions[dir_count] = (1, 0);
        dir_count += 1;
        directions[dir_count] = (-1, 0);
        dir_count += 1;
        directions[dir_count] = (0, 1);
        dir_count += 1;
        directions[dir_count] = (0, -1);
        dir_count += 1;
    }
    
    if diagonal {
        directions[dir_count] = (1, 1);
        dir_count += 1;
        directions[dir_count] = (1, -1);
        dir_count += 1;
        directions[dir_count] = (-1, 1);
        dir_count += 1;
        directions[dir_count] = (-1, -1);
        dir_count += 1;
    }
    
    for i in 0..dir_count {
        let dr = directions[i].0;
        let dc = directions[i].1;
        
        let mut current_row = (row as i8) + dr;
        let mut current_col = (col as i8) + dc;
        
        for _ in 0..7 {
            if current_row < 0 || current_row >= 8 || current_col < 0 || current_col >= 8 {
                break;
            }
            
            let target = (current_row as u8) * 8 + (current_col as u8);
            visible[target] = true;
            
            // Stop at first piece (but mark it as visible)
            if crate::get_piece_type(board[target]) != crate::EMPTY {
                break;
            }
            
            current_row += dr;
            current_col += dc;
        }
    }
}

// Prove that revealed squares match visibility rules
pub fn prove_visibility(
    board: [u8; 64],
    player_color: u8,
    revealed_squares: [bool; 64],
    salt: Field
) -> Field {
    let computed_visibility = compute_visibility_mask(board, player_color);
    
    // Verify revealed squares are subset of visible squares
    for i in 0..64 {
        if revealed_squares[i] {
            assert(computed_visibility[i]);
        }
    }
    
    // Return commitment to visibility mask
    let mut visibility_fields: [Field; 64] = [0; 64];
    for i in 0..64 {
        visibility_fields[i] = if computed_visibility[i] { 1 } else { 0 };
    }
    
    // Hash in chunks
    let mut chunk_hashes: [Field; 8] = [0; 8];
    for i in 0..8 {
        let mut chunk: [Field; 8] = [0; 8];
        for j in 0..8 {
            chunk[j] = visibility_fields[i * 8 + j];
        }
        chunk_hashes[i] = std::hash::pedersen_hash(chunk);
    }
    
    let mut final_input: [Field; 9] = [0; 9];
    for i in 0..8 {
        final_input[i] = chunk_hashes[i];
    }
    final_input[8] = salt;
    
    std::hash::pedersen_hash(final_input)
}
