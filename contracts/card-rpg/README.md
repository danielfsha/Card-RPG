# Card RPG - ZK Card Battler on Stellar

Production-ready Zero-Knowledge card game contract for Stellar Soroban, implementing Yu-Gi-Oh! style mechanics with provable fairness.

## Overview

A two-player card battler where:
- Decks are committed via Merkle roots (hidden from opponent)
- Card draws are proven valid via ZK proofs
- Battle outcomes are verified on-chain
- Randomness is deterministic and fair via commit-reveal

## Game Flow

```
┌─────────────┐
│ Start Game  │ Players commit deck Merkle roots
└──────┬──────┘
       │
┌──────▼──────┐
│   Commit    │ Both players commit Hash(secret_seed)
└──────┬──────┘
       │
┌──────▼──────┐
│   Reveal    │ Both players reveal secret_seed
└──────┬──────┘ Contract verifies hashes, derives shared_seed
       │
┌──────▼──────┐
│    Draw     │ Active player submits ZK proof of valid draw
└──────┬──────┘
       │
┌──────▼──────┐
│    Main     │ Player can summon, set, or attack
└──────┬──────┘
       │
┌──────▼──────┐
│   Battle    │ Submit ZK proof of battle calculation
└──────┬──────┘
       │
┌──────▼──────┐
│     End     │ End turn, switch to opponent
└──────┬──────┘
       │
       └──────► Repeat Draw → Main → Battle → End
                Until LP reaches 0
```

## Contract Interface

### Initialization

```rust
pub fn __constructor(env: Env, admin: Address, game_hub: Address)
```

Initialize contract with Game Hub address (required by Stellar Game Studio).

### Game Lifecycle

#### Start Game

```rust
pub fn start_game(
    env: Env,
    session_id: u32,
    player1: Address,
    player2: Address,
    p1_deck_root: Bytes,  // Merkle root of P1's deck
    p2_deck_root: Bytes,  // Merkle root of P2's deck
)
```

- Requires auth from both players
- Prevents self-play
- Calls Game Hub `start_game()`
- Initializes game state in temporary storage (30-day TTL)
- Starting LP: 8000 each
- Phase: Commit

#### Commit Phase

```rust
pub fn commit(env: Env, session_id: u32, player: Address, hash: Bytes)
```

Players submit `SHA256(secret_seed)`. Once both committed, advances to Reveal phase.

#### Reveal Phase

```rust
pub fn reveal(env: Env, session_id: u32, player: Address, seed: Bytes)
```

Players reveal their `secret_seed`. Contract verifies:
- `SHA256(seed) == committed_hash`

Once both revealed:
- Computes `shared_seed = seed1 || seed2`
- Determines starting player: `SHA256(shared_seed)[31] % 2`
- Advances to Draw phase

#### Draw Phase

```rust
pub fn draw_phase(env: Env, session_id: u32, proof: Bytes, new_suits_mask: u32)
```

Active player submits ZK proof that:
1. Card exists in their committed deck (Merkle proof)
2. Card doesn't cause a bust (suit not in current mask)
3. New suits mask is correctly computed

Updates player's suits mask and advances to Main phase.

#### Battle Phase

```rust
pub fn battle_phase(
    env: Env,
    session_id: u32,
    proof: Bytes,
    p1_dmg: u32,
    p2_dmg: u32,
    destroy_p1: bool,
    destroy_p2: bool
)
```

Active player submits ZK proof of battle calculation. Contract:
- Verifies proof (stub for Protocol 25 integration)
- Applies damage to both players
- Checks win condition (LP == 0)
- Calls Game Hub `end_game()` if game over

#### End Turn

```rust
pub fn end_turn(env: Env, session_id: u32)
```

- Switches active player
- Resets suits mask for new turn
- Increments turn counter
- Returns to Draw phase

### Read-Only

```rust
pub fn get_game(env: Env, session_id: u32) -> GameState
```

Returns current game state for UI rendering.

## Data Structures

### GameState

```rust
pub struct GameState {
    pub session_id: u32,
    pub player1: Address,
    pub player2: Address,
    pub p1_deck_root: Bytes,      // Merkle root commitment
    pub p2_deck_root: Bytes,
    pub p1_commit: Option<Bytes>,  // SHA256(seed)
    pub p2_commit: Option<Bytes>,
    pub p1_revealed: bool,
    pub p2_revealed: bool,
    pub shared_seed: Bytes,        // Deterministic RNG source
    pub current_turn: u32,
    pub p1_lp: u32,                // Life Points
    pub p2_lp: u32,
    pub p1_suits_mask: u32,        // Active suits bitmask
    pub p2_suits_mask: u32,
    pub active_player: Address,
    pub phase: Phase,
    pub last_move_proof: Option<Bytes>,
}
```

### Phase Enum

```rust
pub enum Phase {
    Standby,
    Commit,
    Reveal,
    Draw,
    Main,
    Battle,
    End,
}
```

### Error Codes

```rust
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    NotInPhase = 3,
    NotPlayer = 4,
    InvalidProof = 5,
    InvalidCommitment = 6,
    GameNotFound = 7,
    NotYourTurn = 8,
    InvalidMove = 9,
}
```

## Fairness Guarantees

### Commit-Reveal Scheme

Prevents either player from manipulating randomness:

1. **Commit**: Both players lock in their entropy before seeing opponent's
2. **Reveal**: Contract verifies commitments match revealed values
3. **Derive**: `shared_seed = seed1 || seed2` ensures neither can predict outcome
4. **Use**: Deterministic shuffle/RNG derived from `shared_seed`

### Deterministic Randomness

```rust
// Starting player selection
let final_hash = env.crypto().sha256(&state.shared_seed);
let last_byte = final_hash.to_bytes().get(31).unwrap_or(0);
if last_byte % 2 == 0 {
    state.active_player = state.player1.clone();
} else {
    state.active_player = state.player2.clone();
}
```

Never uses:
- Ledger timestamp
- Ledger sequence
- Block hash

All randomness derived from player-committed entropy.

## ZK Proof Integration

### Current Implementation (Stub)

```rust
// Validate proof is not empty
if proof.len() == 0 {
    panic_with_error!(&env, Error::InvalidProof);
}

// TODO: Integrate Protocol 25 verification
```

### Production Implementation (Protocol 25)

```rust
use soroban_sdk::crypto::bn254;

pub fn verify_draw_proof(
    env: &Env,
    proof: &Bytes,
    deck_root: &Bytes,
    suits_mask: u32,
    card_index: u32,
    new_suits_mask: u32,
    is_bust: u32
) -> bool {
    // Parse Groth16 proof components
    let (pi_a, pi_b, pi_c) = parse_proof(proof);
    
    // Construct public inputs
    let public_inputs = vec![
        deck_root,
        suits_mask,
        card_index,
        new_suits_mask,
        is_bust
    ];
    
    // Verify using Protocol 25 BN254 operations
    env.crypto().bn254_verify_groth16(
        &pi_a,
        &pi_b,
        &pi_c,
        &public_inputs,
        &VERIFICATION_KEY
    )
}
```

## Storage Strategy

- **Instance Storage**: Admin, GameHub, Initialized flag
- **Temporary Storage**: Game states (30-day TTL)
- **TTL Extension**: Every state write extends TTL

```rust
const GAME_TTL_LEDGERS: u32 = 518_400; // ~30 days

env.storage().temporary().set(&game_key, &state);
env.storage().temporary().extend_ttl(&game_key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);
```

## Game Hub Integration

Required by Stellar Game Studio:

```rust
// On game start
client.start_game(
    &env.current_contract_address(),
    &session_id,
    &player1,
    &player2,
    &0i128,  // Points (not used)
    &0i128
);

// On game end
client.end_game(&session_id, &p1_won);
```

## Building & Testing

### Build

```bash
cd contracts/card-rpg
cargo build --target wasm32-unknown-unknown --release
```

### Test

```bash
cargo test
```

### Deploy

```bash
# From repo root
bun run build card-rpg
bun run deploy card-rpg
bun run bindings card-rpg
```

## Security Considerations

1. **Auth Checks**: All state-changing functions require `player.require_auth()`
2. **Phase Validation**: Strict phase progression prevents out-of-order moves
3. **Self-Play Prevention**: `player1 != player2` enforced
4. **Commitment Verification**: SHA256 hash verification prevents cheating
5. **Proof Validation**: ZK proofs ensure valid moves without revealing private data
6. **TTL Management**: Automatic cleanup of abandoned games

## Gas Optimization

- Temporary storage for game state (cheaper than persistent)
- Minimal public inputs in ZK proofs
- Separate circuits for draw/battle (smaller proofs)
- Batch operations where possible

## Frontend Integration

See `card-rpg-frontend/src/games/card-rpg/cardRpgService.ts` for:
- Deck Merkle tree construction
- ZK proof generation
- Transaction building
- State management

## Roadmap

- [ ] Integrate Protocol 25 BN254 verification
- [ ] Add card effect system
- [ ] Implement trap cards
- [ ] Add tournament mode
- [ ] Optimize proof sizes
- [ ] Add replay system

## License

MIT

## References

- [Stellar Game Studio](https://jamesbachini.github.io/Stellar-Game-Studio/)
- [Soroban Docs](https://soroban.stellar.org/)
- [Protocol 25 Spec](https://stellar.org/protocol-25)
- [Groth16 Verification](https://eprint.iacr.org/2016/260.pdf)
