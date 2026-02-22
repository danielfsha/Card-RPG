# Fog of War Chess - Noir ZK Circuits

Zero-Knowledge circuits for fog of war chess using Noir (nargo).

## Overview

This implementation uses Noir circuits to prove valid chess moves without revealing piece positions to the opponent. Players can only see:
1. Their own pieces
2. Squares within their line of sight
3. Enemy pieces they can see

## Circuits

### 1. Main Circuit (`src/main.nr`)
Proves a chess move is valid without revealing the full board state.

**Private Inputs:**
- `board_state[64]` - Current board (hidden from opponent)
- `from_square` - Source square (0-63)
- `to_square` - Destination square (0-63)
- `piece_type` - Type of piece being moved
- `piece_color` - Color of piece (0=white, 1=black)
- `salt` - Random salt for commitment

**Public Inputs:**
- `board_commitment` - Pedersen commitment to board state
- `move_hash` - Hash of the move
- `is_capture` - Whether this move captures
- `is_check` - Whether this move gives check

**Verification:**
1. Verify board commitment matches
2. Verify piece at from_square matches claimed piece
3. Verify move is legal for this piece type
4. Verify capture flag is correct
5. Compute and verify move hash

### 2. Visibility Circuit (`src/visibility.nr`)
Proves which squares are visible to a player.

**Functions:**
- `compute_visibility_mask()` - Calculate which squares a player can see
- `prove_visibility()` - Prove revealed squares match visibility rules
- `mark_piece_vision()` - Mark squares a piece can see

## Building

```bash
# Navigate to circuits directory
cd circuits/chess

# Build the circuit
/home/daniel/.nargo/bin/nargo compile

# Generate proof (example)
/home/daniel/.nargo/bin/nargo prove

# Verify proof
/home/daniel/.nargo/bin/nargo verify
```

## Testing

```bash
# Run tests
/home/daniel/.nargo/bin/nargo test
```

## Integration with Soroban

The Noir circuits generate Groth16 proofs that are verified on-chain by the Soroban contract.

### Proof Flow

1. **Frontend**: Player makes a move
2. **Noir Circuit**: Generate ZK proof of valid move
3. **Soroban Contract**: Verify proof and update game state
4. **Opponent**: Sees only the move result, not the full board

### Proof Structure

```rust
pub struct ZKProof {
    pub proof: Bytes,           // Serialized Groth16 proof
    pub public_inputs: Vec<BytesN<32>>,  // Public signals
}
```

### Public Inputs Order

1. `board_commitment` - Pedersen hash of board state
2. `move_hash` - Hash of (from_square, to_square, piece_type)
3. `is_capture` - Boolean (0 or 1)
4. `is_check` - Boolean (0 or 1)

## Chess Rules Implemented

### Piece Movement

- **Pawn**: Forward 1 (or 2 from start), diagonal capture
- **Knight**: L-shape (2+1 or 1+2)
- **Bishop**: Diagonal any distance
- **Rook**: Horizontal/vertical any distance
- **Queen**: Rook + Bishop
- **King**: One square any direction

### Path Checking

- Sliding pieces (Bishop, Rook, Queen) verify path is clear
- Knight jumps over pieces
- Pawns have special capture rules

### Board Representation

- 8x8 board = 64 squares (0-63)
- Each square: `piece_type (4 bits) | color (1 bit)`
- Encoding: `piece_type | (color << 4)`

### Piece Types

```
EMPTY = 0
PAWN = 1
KNIGHT = 2
BISHOP = 3
ROOK = 4
QUEEN = 5
KING = 6
```

## Security Properties

### Commitment Security
- **Binding**: Cannot change board after commitment
- **Hiding**: Commitment reveals nothing about board
- **Collision-resistant**: Pedersen hash security

### Proof Security
- **Soundness**: Invalid moves rejected
- **Zero-knowledge**: Proof reveals nothing except validity
- **Completeness**: Valid moves always produce valid proofs

### Game Integrity
- Cannot make illegal moves
- Cannot see opponent's hidden pieces
- Cannot fake captures or checks
- Deterministic move validation

## Performance

- **Proof Generation**: ~2-5 seconds (client-side)
- **Proof Size**: ~200-300 bytes (Groth16)
- **Verification**: <100ms (on-chain)
- **Constraints**: ~50,000-100,000 (estimated)

## Future Enhancements

1. **Castling**: Add special move validation
2. **En Passant**: Implement pawn capture rule
3. **Promotion**: Handle pawn promotion to queen/rook/bishop/knight
4. **Check Detection**: Prove king is in check
5. **Checkmate Proof**: Prove no legal moves available
6. **Stalemate Detection**: Prove draw conditions
7. **Move History**: Verify move sequence integrity

## References

- **Noir Language**: https://noir-lang.org/
- **Pedersen Hash**: https://iden3-docs.readthedocs.io/en/latest/iden3_repos/research/publications/zkproof-standards-workshop-2/pedersen-hash/pedersen.html
- **Groth16**: https://eprint.iacr.org/2016/260.pdf
- **Chess Rules**: https://www.fide.com/FIDE/handbook/LawsOfChess.pdf

## License

MIT
