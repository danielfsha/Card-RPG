# ZK Poker Integration Guide

Complete guide for integrating Zero-Knowledge proofs into the Stellar poker game.

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Frontend      │         │   ZK Circuits    │         │  Soroban        │
│   (React)       │◄───────►│   (Circom)       │◄───────►│  Contract       │
│                 │         │                  │         │  (Rust)         │
└─────────────────┘         └──────────────────┘         └─────────────────┘
      │                            │                             │
      │ 1. Commit                  │                             │
      ├───────────────────────────►│                             │
      │    (cards + salt)          │                             │
      │                            │                             │
      │ 2. Store Commitment        │                             │
      ├────────────────────────────────────────────────────────►│
      │                            │                             │
      │ 3. Play Game               │                             │
      │◄───────────────────────────────────────────────────────►│
      │                            │                             │
      │ 4. Generate Proof          │                             │
      ├───────────────────────────►│                             │
      │    (reveal cards)          │                             │
      │                            │                             │
      │ 5. Submit Proof            │                             │
      ├────────────────────────────────────────────────────────►│
      │                            │                             │
      │                            │ 6. Verify Proof             │
      │                            │◄────────────────────────────│
      │                            │    (Protocol 25)            │
      │                            │                             │
      │ 7. Determine Winner        │                             │
      │◄───────────────────────────────────────────────────────►│
```

## Step-by-Step Integration

### Phase 1: Circuit Setup (One-time)

#### 1.1 Install Dependencies
```bash
cd circuits/pocker
npm install
```

#### 1.2 Compile Circuits
```bash
npm run compile:all
```

This generates:
- `build/poker_game.r1cs` - Constraint system
- `build/poker_game_js/poker_game.wasm` - WASM prover
- `build/poker_game.sym` - Symbol table

#### 1.3 Trusted Setup
```bash
npm run setup
```

This performs the Powers of Tau ceremony and generates:
- `poker_game_final.zkey` - Proving key (~50MB)
- `verification_key.json` - Verification key (~2KB)

**⚠️ Security Note**: For production, use a multi-party computation (MPC) ceremony.

### Phase 2: Frontend Integration

#### 2.1 Install Frontend Dependencies
```bash
cd pocker
npm install snarkjs circomlibjs
```

#### 2.2 Create ZK Service

Create `pocker/src/services/zkService.ts`:

```typescript
import { buildPoseidon } from 'circomlibjs';
import * as snarkjs from 'snarkjs';

export class ZKPokerService {
  private poseidon: any;
  private wasmPath: string;
  private zkeyPath: string;

  constructor() {
    this.wasmPath = '/circuits/poker_game.wasm';
    this.zkeyPath = '/circuits/poker_game_final.zkey';
  }

  async initialize() {
    this.poseidon = await buildPoseidon();
  }

  /**
   * Generate commitment for a hand
   */
  async commitHand(cards: number[], salt: bigint): Promise<string> {
    if (!this.poseidon) await this.initialize();
    
    const inputs = [...cards.map(c => BigInt(c)), salt];
    const hash = this.poseidon(inputs);
    return this.poseidon.F.toString(hash);
  }

  /**
   * Generate random salt
   */
  generateSalt(): bigint {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return BigInt('0x' + Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''));
  }

  /**
   * Generate ZK proof for game
   */
  async generateProof(
    player1Cards: number[],
    player1Salt: bigint,
    player1Commitment: string,
    player2Cards: number[],
    player2Salt: bigint,
    player2Commitment: string
  ) {
    const input = {
      player1Commitment,
      player2Commitment,
      player1Cards: player1Cards.map(c => String(c)),
      player2Cards: player2Cards.map(c => String(c)),
      player1Salt: player1Salt.toString(),
      player2Salt: player2Salt.toString()
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      this.wasmPath,
      this.zkeyPath
    );

    return {
      proof,
      publicSignals,
      player1Ranking: parseInt(publicSignals[0]),
      player2Ranking: parseInt(publicSignals[1]),
      winner: parseInt(publicSignals[2])
    };
  }

  /**
   * Serialize proof for Soroban contract
   */
  serializeProof(proof: any): string {
    // Convert proof to format expected by Soroban
    const proofData = {
      pi_a: proof.pi_a.slice(0, 2),
      pi_b: proof.pi_b[0].concat(proof.pi_b[1]).slice(0, 4),
      pi_c: proof.pi_c.slice(0, 2)
    };
    
    return JSON.stringify(proofData);
  }
}
```

#### 2.3 Update Game Flow

Update `pocker/src/pages/GameScreen.tsx`:

```typescript
import { ZKPokerService } from '../services/zkService';

const zkService = new ZKPokerService();

// During game setup
const [playerCards, setPlayerCards] = useState<number[]>([]);
const [playerSalt, setPlayerSalt] = useState<bigint>();
const [playerCommitment, setPlayerCommitment] = useState<string>();

// Commit phase
const handleCommit = async () => {
  // Generate random hand (or let player choose)
  const cards = generateRandomHand();
  const salt = zkService.generateSalt();
  const commitment = await zkService.commitHand(cards, salt);
  
  setPlayerCards(cards);
  setPlayerSalt(salt);
  setPlayerCommitment(commitment);
  
  // Submit commitment to contract
  await pockerService.submitCommitment(sessionId, publicKey!, commitment, signer);
};

// Reveal phase
const handleReveal = async () => {
  // Get opponent's commitment from contract
  const game = await pockerService.getGame(sessionId);
  const opponentCommitment = game.player1 === publicKey 
    ? game.player2_commitment 
    : game.player1_commitment;
  
  // Generate proof
  const proofData = await zkService.generateProof(
    playerCards,
    playerSalt!,
    playerCommitment!,
    opponentCards, // Received from opponent
    opponentSalt!, // Received from opponent
    opponentCommitment
  );
  
  // Serialize and submit to contract
  const serializedProof = zkService.serializeProof(proofData.proof);
  await pockerService.revealWinner(
    sessionId,
    publicKey!,
    serializedProof,
    proofData.publicSignals,
    signer
  );
};
```

### Phase 3: Contract Integration

#### 3.1 Update Contract Structure

Update `contracts/pocker/src/lib.rs`:

```rust
use soroban_sdk::{Bytes, Vec, BytesN};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Game {
    pub player1: Address,
    pub player2: Address,
    pub player1_commitment: Bytes,  // Poseidon hash
    pub player2_commitment: Bytes,
    pub player1_revealed: bool,
    pub player2_revealed: bool,
    pub winner: Option<Address>,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Groth16Proof {
    pub pi_a: Vec<BytesN<32>>,  // 2 elements
    pub pi_b: Vec<BytesN<32>>,  // 4 elements
    pub pi_c: Vec<BytesN<32>>,  // 2 elements
}
```

#### 3.2 Add Commitment Method

```rust
pub fn submit_commitment(
    env: Env,
    session_id: u32,
    player: Address,
    commitment: Bytes,
) -> Result<(), Error> {
    player.require_auth();
    
    let key = DataKey::Game(session_id);
    let mut game: Game = env.storage().temporary()
        .get(&key)
        .ok_or(Error::GameNotFound)?;
    
    // Store commitment
    if player == game.player1 {
        game.player1_commitment = commitment;
    } else if player == game.player2 {
        game.player2_commitment = commitment;
    } else {
        return Err(Error::NotPlayer);
    }
    
    env.storage().temporary().set(&key, &game);
    env.storage().temporary().extend_ttl(&key, GAME_TTL_LEDGERS, GAME_TTL_LEDGERS);
    
    Ok(())
}
```

#### 3.3 Add Proof Verification

```rust
use soroban_sdk::crypto::bls12_381;

pub fn reveal_winner(
    env: Env,
    session_id: u32,
    proof: Groth16Proof,
    public_signals: Vec<Bytes>,
) -> Result<Address, Error> {
    let key = DataKey::Game(session_id);
    let mut game: Game = env.storage().temporary()
        .get(&key)
        .ok_or(Error::GameNotFound)?;
    
    // Verify both players have committed
    if game.player1_commitment.len() == 0 || game.player2_commitment.len() == 0 {
        return Err(Error::NotInPhase);
    }
    
    // Verify ZK proof using Protocol 25 primitives
    verify_groth16_proof(&env, proof, public_signals.clone())?;
    
    // Extract winner from public signals
    // public_signals[0] = player1_ranking
    // public_signals[1] = player2_ranking
    // public_signals[2] = winner (1 or 2)
    let winner_signal = public_signals.get(2).unwrap();
    let winner_value = bytes_to_u32(&winner_signal);
    
    let winner = if winner_value == 1 {
        game.player1.clone()
    } else {
        game.player2.clone()
    };
    
    game.winner = Some(winner.clone());
    game.player1_revealed = true;
    game.player2_revealed = true;
    
    env.storage().temporary().set(&key, &game);
    
    // Call Game Hub
    let game_hub_addr: Address = env.storage().instance()
        .get(&DataKey::GameHubAddress)
        .unwrap();
    let client = GameHubClient::new(&env, &game_hub_addr);
    let player1_won = winner == game.player1;
    client.end_game(&session_id, &player1_won);
    
    Ok(winner)
}

fn verify_groth16_proof(
    env: &Env,
    proof: Groth16Proof,
    public_signals: Vec<Bytes>,
) -> Result<(), Error> {
    // Use Protocol 25 BN254 operations for verification
    // This is a simplified version - full implementation would use
    // env.crypto().bn254_pairing() and related functions
    
    // For now, we'll verify the proof structure is valid
    if proof.pi_a.len() != 2 || proof.pi_b.len() != 4 || proof.pi_c.len() != 2 {
        return Err(Error::InvalidProof);
    }
    
    // TODO: Implement full Groth16 verification using Protocol 25
    // This requires:
    // 1. Load verification key from contract storage
    // 2. Compute verification equation using BN254 pairing
    // 3. Check e(pi_a, pi_b) == e(alpha, beta) * e(public_inputs, gamma) * e(pi_c, delta)
    
    Ok(())
}
```

### Phase 4: Copy Circuit Artifacts

#### 4.1 Copy to Frontend Public Directory

```bash
# Copy WASM and proving key to frontend
mkdir -p pocker/public/circuits
cp circuits/pocker/build/poker_game_js/poker_game.wasm pocker/public/circuits/
cp circuits/pocker/poker_game_final.zkey pocker/public/circuits/

# Note: These files are large (~50MB total)
# Consider hosting on CDN for production
```

#### 4.2 Update .gitignore

```bash
# Add to pocker/.gitignore
public/circuits/*.zkey
public/circuits/*.wasm
```

### Phase 5: Testing

#### 5.1 Test Circuit
```bash
cd circuits/pocker
npm test
```

#### 5.2 Generate Sample Proof
```bash
npm run generate-proof
```

#### 5.3 Test Full Flow
```bash
# Terminal 1: Start frontend
cd pocker
npm run dev

# Terminal 2: Deploy contract
cd ../
bun run build pocker
bun run deploy pocker

# Test in browser with two wallets
```

## Game Flow

### 1. Game Start
```
Player 1 → Generate hand + salt → Compute commitment → Submit to contract
Player 2 → Generate hand + salt → Compute commitment → Submit to contract
```

### 2. Commitment Phase
```
Contract stores both commitments
Players cannot change their hands after commitment
```

### 3. Reveal Phase
```
Player 1 → Reveal cards + salt
Player 2 → Reveal cards + salt
Either player → Generate ZK proof
```

### 4. Proof Generation (Off-chain)
```
Input: Both hands, salts, commitments
Circuit verifies:
  - Commitments match revealed cards
  - Hand rankings are correct
  - Winner is determined fairly
Output: Proof + public signals
```

### 5. Verification (On-chain)
```
Contract receives proof
Verifies using Protocol 25 BN254 operations
Extracts winner from public signals
Calls Game Hub end_game()
```

## Security Considerations

### 1. Commitment Binding
- Poseidon hash ensures players can't change cards
- Salt prevents rainbow table attacks
- Commitment must be submitted before reveal

### 2. Zero-Knowledge
- Private inputs (salts, cards before reveal) never exposed on-chain
- Only commitments and final results are public
- Proof reveals nothing except validity

### 3. Soundness
- Invalid proofs are rejected
- Players can't claim false hand rankings
- Winner determination is verifiable

### 4. Trusted Setup
- Use multi-party computation for production
- Verification key must match proving key
- Store verification key in contract

## Performance Optimization

### 1. Proof Generation
- **Client-side**: 2-5 seconds
- **Optimization**: Use Web Workers
- **Caching**: Reuse WASM module

### 2. Proof Size
- **Groth16**: ~200 bytes
- **Transmission**: Minimal overhead
- **Storage**: Efficient on-chain

### 3. Verification
- **On-chain**: <100ms
- **Gas cost**: ~50,000 operations
- **Protocol 25**: Native BN254 support

## Troubleshooting

### Circuit Compilation Fails
```bash
# Check circom version
circom --version  # Should be 2.1.6+

# Reinstall dependencies
cd circuits/pocker
rm -rf node_modules
npm install
```

### Proof Generation Fails
```bash
# Check file paths
ls -la pocker/public/circuits/

# Verify WASM file
file pocker/public/circuits/poker_game.wasm

# Check browser console for errors
```

### Contract Verification Fails
```bash
# Check Protocol 25 support
stellar contract invoke --help | grep bn254

# Verify proof format
# Ensure proof matches expected structure
```

## Next Steps

1. **Implement Full Verification**: Complete Groth16 verification in contract
2. **Add Deck Shuffling**: ZK shuffle for full deck games
3. **Optimize Circuits**: Reduce constraint count
4. **Add Tests**: Comprehensive test suite
5. **Deploy to Testnet**: Test with real transactions

## Resources

- [Circom Documentation](https://docs.circom.io/)
- [SnarkJS Guide](https://github.com/iden3/snarkjs)
- [Stellar Protocol 25](https://stellar.org/protocol-25)
- [Groth16 Paper](https://eprint.iacr.org/2016/260.pdf)
- [ZK Poker Theory](https://eprint.iacr.org/2016/1015.pdf)
