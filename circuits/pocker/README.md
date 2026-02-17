# ZK Poker Circuits

Zero-Knowledge circuits for provably fair poker on Stellar blockchain using Protocol 25 (X-Ray) cryptographic primitives.

## Overview

This implementation uses ZK-SNARKs to enable:
- **Hidden Hands**: Players commit to their cards without revealing them
- **Provable Reveals**: Cards revealed at showdown are proven to match commitments
- **Fair Ranking**: Hand rankings are computed in zero-knowledge
- **No Cheating**: Impossible to change cards after commitment

## Circuits

### 1. `card_commitment.circom`
Commits to a 5-card poker hand using Poseidon hash.

**Inputs:**
- `cards[5]` (private): Array of card values (0-51)
- `salt` (private): Random salt for commitment

**Outputs:**
- `commitment` (public): Poseidon hash of cards + salt

**Constraints:**
- Each card must be in range 0-51
- No duplicate cards allowed

### 2. `card_reveal.circom`
Proves revealed cards match a previous commitment.

**Inputs:**
- `commitment` (public): Original commitment hash
- `revealedCards[5]` (public): Cards being revealed
- `salt` (private): Salt used in original commitment

**Validates:**
- Poseidon(revealedCards + salt) == commitment

### 3. `hand_ranking.circom`
Computes poker hand ranking (0-9).

**Rankings:**
- 0 = High Card
- 1 = One Pair
- 2 = Two Pair
- 3 = Three of a Kind
- 4 = Straight
- 5 = Flush
- 6 = Full House
- 7 = Four of a Kind
- 8 = Straight Flush
- 9 = Royal Flush

**Inputs:**
- `cards[5]` (public): Array of card values

**Outputs:**
- `ranking` (public): Hand ranking (0-9)
- `highCard` (public): Tiebreaker value

### 4. `poker_game.circom`
Complete game circuit combining all mechanics.

**Inputs:**
- `player1Commitment` (public): Player 1's commitment
- `player2Commitment` (public): Player 2's commitment
- `player1Cards[5]` (public): Player 1's revealed cards
- `player2Cards[5]` (public): Player 2's revealed cards
- `player1Salt` (private): Player 1's salt
- `player2Salt` (private): Player 2's salt

**Outputs:**
- `player1Ranking` (public): Player 1's hand ranking
- `player2Ranking` (public): Player 2's hand ranking
- `winner` (public): 1 = player1, 2 = player2, 0 = tie

## Setup

### Prerequisites
```bash
# Install circom compiler
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom

# Install snarkjs
npm install -g snarkjs
```

### Installation
```bash
cd circuits/pocker
npm install
```

### Compile Circuits
```bash
# Compile all circuits
npm run compile:all

# Or compile individually
npm run compile:commitment
npm run compile:reveal
npm run compile:ranking
npm run compile
```

### Generate Trusted Setup
```bash
# Powers of Tau ceremony (one-time setup)
snarkjs powersoftau new bn128 14 pot14_0000.ptau -v
snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau --name="First contribution" -v
snarkjs powersoftau prepare phase2 pot14_0001.ptau pot14_final.ptau -v

# Generate proving and verification keys for main circuit
snarkjs groth16 setup build/poker_game.r1cs pot14_final.ptau poker_game_0000.zkey
snarkjs zkey contribute poker_game_0000.zkey poker_game_final.zkey --name="Poker contribution" -v
snarkjs zkey export verificationkey poker_game_final.zkey verification_key.json

# Export Solidity verifier (for reference - we'll use Stellar's native verification)
snarkjs zkey export solidityverifier poker_game_final.zkey verifier.sol
```

## Usage

### 1. Commit Phase (Off-chain)
```javascript
const { buildPoseidon } = require('circomlibjs');

async function commitHand(cards, salt) {
  const poseidon = await buildPoseidon();
  const inputs = [...cards, salt];
  const commitment = poseidon.F.toString(poseidon(inputs));
  return commitment;
}

// Example
const player1Cards = [0, 13, 26, 39, 51]; // A♠, A♥, A♦, A♣, K♠
const player1Salt = BigInt("0x" + crypto.randomBytes(32).toString('hex'));
const player1Commitment = await commitHand(player1Cards, player1Salt);
```

### 2. Generate Proof (Off-chain)
```javascript
const snarkjs = require('snarkjs');

async function generateProof(player1Cards, player1Salt, player2Cards, player2Salt, 
                             player1Commitment, player2Commitment) {
  const input = {
    player1Commitment,
    player2Commitment,
    player1Cards,
    player2Cards,
    player1Salt,
    player2Salt
  };
  
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    "build/poker_game_js/poker_game.wasm",
    "poker_game_final.zkey"
  );
  
  return { proof, publicSignals };
}
```

### 3. Verify On-Chain (Stellar Contract)
The Soroban contract uses Protocol 25 primitives to verify proofs:

```rust
// In contracts/pocker/src/lib.rs
pub fn reveal_winner(
    env: Env,
    session_id: u32,
    proof: Bytes,
    public_signals: Vec<Bytes>
) -> Result<Address, Error> {
    // Verify ZK proof using Protocol 25 BN254 operations
    verify_groth16_proof(&env, proof, public_signals)?;
    
    // Extract winner from public signals
    let winner_signal = public_signals.get(2).unwrap();
    // ... determine winner
}
```

## Card Encoding

Cards are encoded as integers 0-51:
- **Rank**: `card % 13` (0=A, 1=2, ..., 12=K)
- **Suit**: `card / 13` (0=♠, 1=♥, 2=♦, 3=♣)

Examples:
- `0` = A♠ (Ace of Spades)
- `13` = A♥ (Ace of Hearts)
- `51` = K♣ (King of Clubs)

## Integration with Stellar

### Protocol 25 (X-Ray) Features Used:
1. **BN254 Elliptic Curve**: For Groth16 proof verification
2. **Poseidon Hash**: For efficient commitment scheme
3. **Native Verification**: On-chain proof verification without external oracles

### Contract Flow:
1. **Commit Phase**: Players submit commitments on-chain
2. **Play Phase**: Game progresses with hidden hands
3. **Reveal Phase**: Players reveal cards + generate proof off-chain
4. **Verify Phase**: Contract verifies proof and determines winner

## Testing

```bash
# Run circuit tests
npm test

# Generate sample proof
npm run generate-proof
```

## Security Considerations

1. **Commitment Binding**: Poseidon hash ensures players can't change cards after commitment
2. **Zero-Knowledge**: Private inputs (salts, cards before reveal) never exposed
3. **Soundness**: Invalid proofs are rejected by verification
4. **Completeness**: Valid games always produce valid proofs

## Performance

- **Proof Generation**: ~2-5 seconds (client-side)
- **Proof Size**: ~200 bytes (Groth16)
- **Verification**: <100ms (on-chain)
- **Constraints**: ~50,000 (poker_game circuit)

## Future Improvements

1. **Deck Shuffling**: Add ZK shuffle for full deck games
2. **Multi-Round**: Support Texas Hold'em with community cards
3. **Optimizations**: Reduce constraint count for faster proving
4. **Batching**: Verify multiple games in single proof

## References

- [Circom Documentation](https://docs.circom.io/)
- [SnarkJS](https://github.com/iden3/snarkjs)
- [Stellar Protocol 25](https://stellar.org/protocol-25)
- [Groth16 Paper](https://eprint.iacr.org/2016/260.pdf)
