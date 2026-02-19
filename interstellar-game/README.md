# ZK Poker on Stellar

A provably fair, decentralized Texas Hold'em poker implementation leveraging zero-knowledge proofs and the Stellar blockchain. This project demonstrates advanced cryptographic techniques including Groth16 proof systems, Poseidon hashing, and deterministic randomness generation on a distributed ledger.

## Technical Architecture

### Cryptographic Foundations

The game employs a sophisticated cryptographic stack to ensure fairness and privacy:

**Zero-Knowledge Proof System**
- Implements Groth16 proof verification using the BN254 elliptic curve
- Poseidon hash function for efficient commitment schemes in zero-knowledge circuits
- Circuit constraints verify hand rankings without revealing card values
- Proof generation occurs client-side, maintaining player privacy

**Commitment Scheme**
Players commit to their hole cards using Poseidon(card₁, card₂, 0, 0, 0, salt), where the padding accommodates the circuit's 5-card input structure. The commitment is cryptographically binding, preventing players from changing their cards after commitment while keeping them hidden from opponents.

**Deterministic Randomness**
Community cards are generated using a Fisher-Yates shuffle seeded with a keccak256 hash of the session identifier. The pseudorandom number generator (PRNG) provided by Soroban ensures deterministic, verifiable randomness that is consistent across simulation and execution:

```rust
let mut seed_bytes = Bytes::new(env);
seed_bytes.append(&Bytes::from_array(env, &session_id.to_be_bytes()));
let seed_hash = env.crypto().keccak256(&seed_bytes);
let mut prng = env.prng();
prng.seed(seed_hash.into());
```

This approach guarantees that community cards are unpredictable yet reproducible, eliminating any possibility of manipulation while maintaining transparency.

### Smart Contract Architecture

**Soroban Contract Design**
The poker contract is implemented in Rust for the Stellar Soroban smart contract platform, featuring:

- Temporary storage with 30-day TTL for active game states
- Automatic TTL extension on every state mutation
- Integration with Game Hub for lifecycle management and point settlement
- Multi-round betting state machine (Preflop, Flop, Turn, River, Showdown)

**State Management**
Game state is stored in temporary ledger storage, optimizing for cost efficiency while maintaining data availability for active games. The contract tracks:
- Player stacks and current bets
- Community cards (deterministically generated)
- Betting phase and turn order
- Cryptographic commitments for hole cards
- ZK proof verification results

**Betting Logic**
The contract enforces standard poker betting rules:
- Minimum raise of 2x the current bet
- Proper turn sequencing with automatic switching
- Pot accumulation across betting rounds
- Fold, Check, Call, Bet, and Raise actions

### Frontend Implementation

**React + TypeScript Stack**
- Vite for optimized build and development experience
- React 18 with hooks for state management
- TypeScript for type safety across the application
- Tailwind CSS for responsive, modern UI design

**Wallet Integration**
Supports multiple Stellar wallets through the Stellar Wallets Kit:
- Freighter
- Albedo
- xBull
- Development wallet for testing

**ZK Proof Generation**
Client-side proof generation using snarkjs and circomlibjs:
- Asynchronous proof computation to maintain UI responsiveness
- Efficient Poseidon hash implementation in WebAssembly
- Proof serialization for on-chain verification

## Game Flow

### Phase 1: Commitment
Players generate two random hole cards client-side and create a cryptographic commitment using the Poseidon hash function. This commitment is submitted to the blockchain, binding the player to their cards without revealing them.

### Phase 2: Betting Rounds
The game progresses through standard Texas Hold'em betting rounds:
1. **Preflop**: Initial betting with only hole cards known
2. **Flop**: Three community cards revealed, second betting round
3. **Turn**: Fourth community card revealed, third betting round
4. **River**: Fifth community card revealed, final betting round

Community cards are generated deterministically by the smart contract using the session ID as a seed, ensuring fairness and verifiability.

### Phase 3: Showdown
At showdown, players generate zero-knowledge proofs demonstrating:
- Their committed cards match the original commitment
- The hand ranking is correctly computed
- The winner is determined fairly

The smart contract verifies these proofs on-chain and distributes the pot to the winner through the Game Hub.

## Cryptographic Primitives

### BN254 Elliptic Curve
The proof system operates over the BN254 (also known as alt-bn128) elliptic curve, chosen for its efficient pairing operations and widespread support in zero-knowledge proof systems. This curve provides approximately 128 bits of security.

### Poseidon Hash Function
Poseidon is a cryptographic hash function optimized for zero-knowledge proof systems. Unlike traditional hash functions like SHA-256, Poseidon is designed to minimize the number of constraints in arithmetic circuits, making proof generation significantly faster. The hash function operates over a prime field and uses a sponge construction with partial S-boxes for efficiency.

### Groth16 Proof System
Groth16 is a zero-knowledge succinct non-interactive argument of knowledge (zk-SNARK) that produces constant-size proofs regardless of circuit complexity. The proof consists of three elliptic curve points:
- π_a: G1 point (64 bytes)
- π_b: G2 point (128 bytes)  
- π_c: G1 point (64 bytes)

Verification requires a single pairing check, making it extremely efficient for on-chain verification.

## Security Considerations

**Commitment Security**
The Poseidon hash commitment scheme is computationally binding and hiding, meaning:
- Players cannot find two different hands that produce the same commitment (binding)
- The commitment reveals no information about the cards (hiding)

**Randomness Security**
The deterministic PRNG seeded with keccak256(session_id) ensures:
- Unpredictability: Session IDs are generated with sufficient entropy
- Reproducibility: The same seed always produces the same card sequence
- Verifiability: Any party can verify the shuffle was performed correctly

**Smart Contract Security**
- Reentrancy protection through Soroban's execution model
- Proper authorization checks on all state-modifying functions
- Temporary storage prevents state bloat and reduces attack surface
- Integration with Game Hub ensures proper point settlement

## Development

### Prerequisites
- Rust toolchain with wasm32-unknown-unknown target
- Soroban CLI
- Node.js 18+ and Bun
- Stellar testnet account with XLM

### Building the Contract
```bash
bun run build pocker
```

### Deploying to Testnet
```bash
bun run deploy pocker
```

### Generating TypeScript Bindings
```bash
bun run bindings pocker
```

### Running the Frontend
```bash
bun run dev:game pocker
```

## Technical Specifications

**Blockchain**: Stellar (Soroban smart contracts)  
**Proof System**: Groth16 over BN254  
**Hash Function**: Poseidon (6-input variant)  
**Randomness**: Keccak256-seeded PRNG with Fisher-Yates shuffle  
**Storage**: Temporary ledger storage with 30-day TTL  
**Frontend**: React 18, TypeScript, Vite  
**Wallet Support**: Freighter, Albedo, xBull via Stellar Wallets Kit

## Future Enhancements

The current implementation provides a foundation for provably fair poker on Stellar. Potential improvements include:

- Full 7-card hand evaluation in the ZK circuit (2 hole + 5 community)
- Multi-table tournament support
- Optimized circuit design for faster proof generation
- Integration with Stellar DEX for automated rake distribution
- Mobile-responsive UI improvements
- Spectator mode with privacy-preserving hand reveals

## License

MIT License - see LICENSE file for details

## Acknowledgments

This project builds upon several open-source technologies:
- Stellar Development Foundation for the Soroban platform
- iden3 for circom and snarkjs
- The Ethereum community for BN254 curve specifications
- Poseidon hash function designers (Grassi et al.)
