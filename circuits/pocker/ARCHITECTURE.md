# ZK Poker Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ZK Poker Game System                             │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Frontend      │         │   ZK Circuits    │         │  Soroban        │
│   (React)       │◄───────►│   (Circom)       │◄───────►│  Contract       │
│                 │         │                  │         │  (Rust)         │
│  - Wallet UI    │         │  - Poseidon Hash │         │  - Game State   │
│  - Game Screen  │         │  - Groth16 Proof │         │  - Verification │
│  - ZK Service   │         │  - Hand Ranking  │         │  - Game Hub     │
└─────────────────┘         └──────────────────┘         └─────────────────┘
        │                            │                             │
        │                            │                             │
        ▼                            ▼                             ▼
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Playroom Kit   │         │   SnarkJS        │         │  Protocol 25    │
│  (Multiplayer)  │         │   (Proof Gen)    │         │  (BN254/Poseidon│
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

## Component Breakdown

### 1. Frontend Layer (React + TypeScript)

**Components:**
- `SplashScreen.tsx` - Initial landing page
- `ModeSelectScreen.tsx` - Create/Join room
- `LobbyScreen.tsx` - Waiting room with commitments
- `GameScreen.tsx` - Main game interface
- `Header.tsx` - Navigation and wallet info

**Services:**
- `zkService.ts` - ZK proof generation and commitment
- `pockerService.ts` - Contract interaction
- `devWalletService.ts` - Development wallet management

**State Management:**
- `useWallet.ts` - Wallet connection hook
- `useGameEngine.tsx` - Multiplayer state (Playroom)
- `walletSlice.ts` - Wallet state (Zustand)

### 2. ZK Circuit Layer (Circom)

**Circuits:**
1. `card_commitment.circom` (~5K constraints)
   - Input: cards[5], salt
   - Output: commitment (Poseidon hash)
   - Validates: card range, no duplicates

2. `card_reveal.circom` (~3K constraints)
   - Input: commitment, revealedCards[5], salt
   - Validates: Poseidon(cards + salt) == commitment

3. `hand_ranking.circom` (~20K constraints)
   - Input: cards[5]
   - Output: ranking (0-9), highCard
   - Computes: poker hand strength

4. `poker_game.circom` (~50K constraints)
   - Combines all above circuits
   - Verifies both players' commitments
   - Determines winner
   - Output: rankings, winner (1/2/0)

**Build Artifacts:**
- `poker_game.r1cs` - Constraint system
- `poker_game.wasm` - WASM prover (~2MB)
- `poker_game_final.zkey` - Proving key (~50MB)
- `verification_key.json` - Verification key (~2KB)

### 3. Smart Contract Layer (Soroban/Rust)

**Contract Structure:**
```rust
contracts/pocker/src/
├── lib.rs          # Main contract logic
├── verifier.rs     # Groth16 verifier
└── test.rs         # Unit tests
```

**Key Functions:**
- `start_game()` - Initialize game, call Game Hub
- `submit_commitment()` - Store Poseidon hash
- `reveal_winner()` - Verify proof, determine winner, call end_game
- `get_game()` - Query game state

**Storage:**
- Game state (temporary, 30-day TTL)
- Verification key (instance storage)
- Admin & Game Hub addresses

### 4. Protocol 25 Integration

**Cryptographic Primitives:**
- `Poseidon Hash` - Commitment scheme
- `BN254 Curve` - Elliptic curve for proofs
- `Groth16 Verification` - On-chain proof verification

## Game Flow Sequence Diagrams

### Complete Game Flow

```mermaid
sequenceDiagram
    participant P1 as Player 1
    participant F1 as Frontend 1
    participant PR as Playroom
    participant F2 as Frontend 2
    participant P2 as Player 2
    participant SC as Smart Contract
    participant GH as Game Hub

    Note over P1,GH: Connection & Room Setup
    P1->>F1: Connect Wallet
    P1->>F1: Create Room
    F1->>PR: Create Room
    PR-->>F1: Room Code
    
    P2->>F2: Connect Wallet
    P2->>F2: Join Room (code)
    F2->>PR: Join Room
    PR->>F1: Player 2 Joined
    
    Note over P1,GH: Game Initialization
    P1->>F1: Start Game
    F1->>F1: Generate Session ID
    F1->>SC: start_game(session_id, p1, p2, points)
    SC->>P1: Request Auth
    P1->>SC: Sign Transaction
    SC->>P2: Request Auth
    P2->>SC: Sign Transaction
    SC->>GH: start_game()
    GH-->>SC: Success
    SC-->>F1: Game Created
    SC-->>F2: Game Created
    
    Note over P1,GH: COMMITMENT PHASE
    P1->>F1: Select Cards
    F1->>F1: Generate Salt
    F1->>F1: Compute Poseidon(cards + salt)
    F1->>SC: submit_commitment(commitment)
    SC->>P1: Request Auth
    P1->>SC: Sign Transaction
    SC->>SC: Store P1 Commitment
    
    P2->>F2: Select Cards
    F2->>F2: Generate Salt
    F2->>F2: Compute Poseidon(cards + salt)
    F2->>SC: submit_commitment(commitment)
    SC->>P2: Request Auth
    P2->>SC: Sign Transaction
    SC->>SC: Store P2 Commitment
    SC->>SC: Phase = Reveal
    
    Note over P1,GH: REVEAL PHASE
    P1->>F1: Reveal Cards
    F1->>PR: Share (cards + salt)
    PR->>F2: Forward P1 Data
    
    P2->>F2: Reveal Cards
    F2->>PR: Share (cards + salt)
    PR->>F1: Forward P2 Data
    
    Note over F1: Generate ZK Proof (Off-chain)
    F1->>F1: Input: Both hands + salts + commitments
    F1->>F1: Circuit: Verify & Rank
    F1->>F1: Output: Proof + Public Signals
    
    F1->>SC: reveal_winner(proof, signals)
    SC->>P1: Request Auth
    P1->>SC: Sign Transaction
    SC->>SC: Verify Proof (Protocol 25)
    SC->>SC: Extract Winner
    SC->>GH: end_game(player1_won)
    GH-->>SC: Success
    SC-->>F1: Winner Determined
    SC-->>F2: Winner Determined
    F1-->>P1: Display Winner
    F2-->>P2: Display Winner
```

### Commitment Phase Detail

```mermaid
sequenceDiagram
    participant Player
    participant Frontend
    participant ZKService
    participant Contract

    Player->>Frontend: Select 5 Cards
    Frontend->>ZKService: Generate Commitment
    
    Note over ZKService: Commitment Generation
    ZKService->>ZKService: Generate Random Salt (32 bytes)
    ZKService->>ZKService: Compute Poseidon Hash
    Note right of ZKService: hash = Poseidon(card1, card2,<br/>card3, card4, card5, salt)
    ZKService-->>Frontend: Commitment Hash
    
    Frontend->>Frontend: Store Cards + Salt Locally
    Frontend->>Contract: submit_commitment(hash)
    Contract->>Player: Request Signature
    Player->>Contract: Sign & Submit
    Contract->>Contract: Validate Phase = Commit
    Contract->>Contract: Store Commitment
    Contract->>Contract: Check Both Committed
    alt Both Players Committed
        Contract->>Contract: Phase = Reveal
    end
    Contract-->>Frontend: Success
```

### Proof Generation & Verification

```mermaid
sequenceDiagram
    participant F1 as Frontend 1
    participant F2 as Frontend 2
    participant PR as Playroom
    participant Circuit as ZK Circuit (WASM)
    participant SC as Smart Contract
    participant V as Verifier Module
    participant P25 as Protocol 25

    Note over F1,F2: Both Players Reveal
    F1->>PR: Share Cards + Salt
    F2->>PR: Share Cards + Salt
    PR->>F1: Receive P2 Data
    PR->>F2: Receive P1 Data
    
    Note over F1,Circuit: Proof Generation (Client-side)
    F1->>Circuit: Load poker_game.wasm
    F1->>Circuit: Input: All Data
    Note right of Circuit: - P1: cards, salt, commitment<br/>- P2: cards, salt, commitment
    Circuit->>Circuit: Verify Commitments Match
    Circuit->>Circuit: Rank Both Hands
    Circuit->>Circuit: Determine Winner
    Circuit-->>F1: Proof (~200 bytes)
    Circuit-->>F1: Public Signals (rankings, winner)
    
    Note over F1,P25: On-chain Verification
    F1->>SC: reveal_winner(proof, signals)
    SC->>V: verify_groth16(proof, signals)
    
    Note over V,P25: Groth16 Verification
    V->>V: Load Verification Key
    V->>V: Validate Proof Structure
    V->>V: Compute Public Input Contribution
    Note right of V: vk_x = IC[0] + Σ(signal[i] * IC[i+1])
    
    V->>P25: bn254_g1_add(points)
    P25-->>V: Result
    V->>P25: bn254_g1_mul(point, scalar)
    P25-->>V: Result
    
    V->>V: Prepare Pairing Inputs
    Note right of V: e(A,B) * e(C,D) * e(E,F) * e(G,H) = 1
    V->>P25: bn254_pairing(inputs)
    P25-->>V: Valid/Invalid
    
    alt Proof Valid
        V-->>SC: true
        SC->>SC: Extract Winner from Signals
        SC->>SC: Update Game State
        SC-->>F1: Winner
    else Proof Invalid
        V-->>SC: false
        SC-->>F1: Error: Invalid Proof
    end
```

### Multi-Sig Transaction Flow

```mermaid
sequenceDiagram
    participant P1 as Player 1
    participant P2 as Player 2
    participant F1 as Frontend 1
    participant F2 as Frontend 2
    participant SC as Contract
    participant GH as Game Hub

    Note over P1,GH: Multi-Signature start_game
    
    F1->>F1: Generate Session ID
    F1->>SC: Build start_game Transaction
    Note right of F1: Source: Player 2<br/>Signers: P1 + P2
    
    SC->>SC: Simulate Transaction
    SC-->>F1: Auth Entries (Stubbed)
    
    F1->>F1: Extract P1 Auth Entry
    F1->>P1: Request Signature
    P1->>F1: Sign Auth Entry
    F1->>F1: Export Signed Auth Entry XDR
    
    F1->>F2: Share Auth Entry (via Playroom)
    
    F2->>F2: Parse Auth Entry
    F2->>F2: Rebuild Transaction
    F2->>F2: Inject P1 Signed Auth
    F2->>P2: Request P2 Signature
    P2->>F2: Sign Auth Entry
    
    F2->>F2: Combine Both Signatures
    F2->>SC: Submit Complete Transaction
    SC->>SC: Verify Both Signatures
    SC->>GH: start_game()
    GH->>GH: Lock Points
    GH-->>SC: Success
    SC->>SC: Create Game State
    SC-->>F2: Game Created
    SC-->>F1: Game Created
```

## Data Flow

### 1. Commitment Phase
```
Player → Generate Hand → Compute Poseidon(cards + salt) → Store on Contract
```

### 2. Proof Generation (Off-chain)
```
Both Hands + Salts + Commitments
    ↓
Circom Circuit (poker_game.circom)
    ↓
SnarkJS Prover (WASM)
    ↓
Groth16 Proof (~200 bytes) + Public Signals
```

### 3. Verification (On-chain)
```
Proof + Public Signals
    ↓
Soroban Contract (verifier.rs)
    ↓
Protocol 25 BN254 Operations
    ↓
Pairing Check: e(A,B) * e(C,D) * e(E,F) * e(G,H) == 1
    ↓
Valid/Invalid → Determine Winner → Call Game Hub
```

## Security Model

### Commitment Binding
- **Property**: Players cannot change cards after commitment
- **Mechanism**: Poseidon hash is cryptographically binding
- **Attack Prevention**: Preimage resistance prevents finding different cards with same hash

### Zero-Knowledge
- **Property**: Private inputs (salts) never revealed on-chain
- **Mechanism**: ZK proof reveals nothing except validity
- **Attack Prevention**: Soundness ensures invalid proofs rejected

### Fairness
- **Property**: Winner determination is verifiable
- **Mechanism**: Hand rankings computed in ZK circuit
- **Attack Prevention**: Completeness ensures valid games always produce valid proofs

## Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Circuit Constraints | ~50,000 | poker_game.circom |
| Proof Generation Time | 2-5 seconds | Client-side (browser) |
| Proof Size | ~200 bytes | Groth16 |
| Verification Time | <100ms | On-chain (Protocol 25) |
| Proving Key Size | ~50MB | Cached in browser |
| Verification Key Size | ~2KB | Stored in contract |
| WASM Prover Size | ~2MB | Loaded once |

## Deployment Architecture

```
Development:
  - Local Stellar node (stellar-cli)
  - Dev wallets (Freighter)
  - Circuit compilation (local)

Testnet:
  - Stellar Testnet
  - Friendbot funding
  - Contract deployment
  - Frontend (Vercel/Netlify)

Production:
  - Stellar Mainnet
  - Multi-party trusted setup
  - CDN for circuit artifacts
  - Audited contracts
```

## Technology Stack

**Frontend:**
- React 18
- TypeScript
- Vite
- TailwindCSS
- Playroom Kit (multiplayer)
- SnarkJS (proof generation)
- Circomlibjs (Poseidon hash)

**Circuits:**
- Circom 2.1.6
- Circomlib 2.0.5
- SnarkJS 0.7.4
- Groth16 proving system

**Smart Contracts:**
- Soroban SDK
- Rust 1.75+
- Protocol 25 (BN254, Poseidon)

**Infrastructure:**
- Stellar Testnet/Mainnet
- Game Hub contract
- IPFS (circuit artifacts)
- GitHub (source code)

## Future Enhancements

1. **Full Deck Support**
   - 52-card deck with ZK shuffle
   - Texas Hold'em variant
   - Community cards

2. **Multi-Round Games**
   - Betting rounds
   - Folding mechanism
   - Pot management

3. **Optimizations**
   - Reduce constraint count
   - Faster proof generation
   - Smaller proving keys
   - Batch verification

4. **Enhanced Security**
   - Multi-party trusted setup
   - Formal verification
   - Security audit
   - Bug bounty program

## References

- [Circom Documentation](https://docs.circom.io/)
- [SnarkJS Guide](https://github.com/iden3/snarkjs)
- [Stellar Protocol 25](https://stellar.org/protocol-25)
- [Groth16 Paper](https://eprint.iacr.org/2016/260.pdf)
- [Soroban Documentation](https://soroban.stellar.org/)
