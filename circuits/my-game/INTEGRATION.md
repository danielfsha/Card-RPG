# Card Battle Game - ZK Circuit Integration Guide

This guide explains how to integrate the ZK circuits with your Yu-Gi-Oh style card game on Stellar.

## Game Rules Summary

- 2 players, 40-card decks, 8000 starting LP
- 5 monster zones per player
- Initial hand: 5 cards
- Turn structure: Main Phase → Battle Phase (optional) → End Phase
- One action per turn: Either summon OR attack (not both)
- Drawing costs 500 LP (max 1 draw per turn)
- Win conditions: Opponent LP = 0 OR opponent deck out

## Architecture Overview

```
Frontend (React/TypeScript)
    ↓
ZK Service (snarkjs)
    ↓
Generate Proofs
    ↓
Soroban Contract (Rust)
    ↓
Verify Proofs On-Chain
```

## Circuit Files

After running `npm run setup`, you'll have these files for each circuit:

- `{circuit}_final.zkey` - Proving key (used by frontend)
- `{circuit}_verification_key.json` - Verification key (used by contract)
- `build/{circuit}.wasm` - WASM file (used by frontend)

## Frontend Integration

### 1. Copy Circuit Files to Frontend

```bash
# Create circuits directory in frontend
mkdir -p my-game/public/circuits

# Copy WASM files
cp circuits/my-game/build/win_condition_js/win_condition.wasm my-game/public/circuits/
cp circuits/my-game/build/battle_calc_js/battle_calc.wasm my-game/public/circuits/
cp circuits/my-game/build/card_draw_js/card_draw.wasm my-game/public/circuits/
cp circuits/my-game/build/card_summon_js/card_summon.wasm my-game/public/circuits/
cp circuits/my-game/build/direct_attack_js/direct_attack.wasm my-game/public/circuits/
cp circuits/my-game/build/deck_shuffle_js/deck_shuffle.wasm my-game/public/circuits/

# Copy proving keys
cp circuits/my-game/win_condition_final.zkey my-game/public/circuits/
cp circuits/my-game/battle_calc_final.zkey my-game/public/circuits/
cp circuits/my-game/card_draw_final.zkey my-game/public/circuits/
cp circuits/my-game/card_summon_final.zkey my-game/public/circuits/
cp circuits/my-game/direct_attack_final.zkey my-game/public/circuits/
cp circuits/my-game/deck_shuffle_final.zkey my-game/public/circuits/
```

### 2. Create ZK Service

Create `my-game/src/services/zkCardGameService.ts`:

```typescript
import { buildPoseidon } from 'circomlibjs';
import * as snarkjs from 'snarkjs';

export class ZKCardGameService {
  private poseidon: any;
  private initialized: boolean = false;

  async initialize() {
    if (this.initialized) return;
    this.poseidon = await buildPoseidon();
    this.initialized = true;
  }

  // Generate deck commitment (40 cards)
  async commitDeck(cards: number[], salt: bigint): Promise<string> {
    if (!this.initialized) await this.initialize();
    
    // Hash cards in groups of 10 (40 cards / 4 groups)
    const groupHashes: bigint[] = [];
    for (let i = 0; i < 4; i++) {
      const group = cards.slice(i * 10, (i + 1) * 10);
      const hash = this.poseidon(group.map(c => BigInt(c)));
      groupHashes.push(this.poseidon.F.toString(hash));
    }
    
    // Final hash with salt
    const finalHash = this.poseidon([...groupHashes, salt]);
    return this.poseidon.F.toString(finalHash);
  }

  // Generate proof for card draw (costs 500 LP)
  async proveCardDraw(
    deckCommitment: string,
    drawnCard: { id: number; atk: number; def: number },
    remainingCards: number[], // 39 cards after draw
    playerLP: number,
    salt: bigint
  ) {
    const input = {
      deckCommitment,
      drawnCardId: drawnCard.id,
      drawnCardATK: drawnCard.atk,
      drawnCardDEF: drawnCard.def,
      remainingCards: remainingCards.map(c => String(c)),
      playerLP,
      salt: salt.toString()
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      '/circuits/card_draw.wasm',
      '/circuits/card_draw_final.zkey'
    );

    return {
      proof: this.serializeProof(proof),
      publicSignals: publicSignals.map((s: string) => this.signalToBuffer(s)),
      newLP: parseInt(publicSignals[0]) // LP after 500 cost
    };
  }

  // Generate proof for card summon
  async proveCardSummon(
    handCommitment: string,
    summonedCard: { id: number; atk: number; def: number },
    position: number,
    remainingHand: number[],
    handSize: number,
    salt: bigint
  ) {
    const input = {
      handCommitment,
      summonedCardId: summonedCard.id,
      summonedCardATK: summonedCard.atk,
      summonedCardDEF: summonedCard.def,
      summonPosition: position,
      remainingHand: remainingHand.map(c => String(c)),
      handSize,
      salt: salt.toString()
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      '/circuits/card_summon.wasm',
      '/circuits/card_summon_final.zkey'
    );

    return {
      proof: this.serializeProof(proof),
      publicSignals: publicSignals.map((s: string) => this.signalToBuffer(s))
    };
  }

  // Generate proof for battle
  async proveBattle(
    attackerATK: number,
    attackerDEF: number,
    defenderATK: number,
    defenderDEF: number,
    defenderPosition: number,
    attackerLP: number,
    defenderLP: number
  ) {
    const input = {
      attackerATK,
      attackerDEF,
      defenderATK,
      defenderDEF,
      defenderPosition,
      attackerLP,
      defenderLP
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      '/circuits/battle_calc.wasm',
      '/circuits/battle_calc_final.zkey'
    );

    return {
      proof: this.serializeProof(proof),
      publicSignals: publicSignals.map((s: string) => this.signalToBuffer(s)),
      newAttackerLP: parseInt(publicSignals[0]),
      newDefenderLP: parseInt(publicSignals[1]),
      attackerDestroyed: parseInt(publicSignals[2]) === 1,
      defenderDestroyed: parseInt(publicSignals[3]) === 1,
      damage: parseInt(publicSignals[4])
    };
  }

  // Generate proof for direct attack
  async proveDirectAttack(
    attackerATK: number,
    opponentLP: number,
    opponentFieldCount: number
  ) {
    const input = {
      attackerATK,
      opponentLP,
      opponentFieldCount
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      '/circuits/direct_attack.wasm',
      '/circuits/direct_attack_final.zkey'
    );

    return {
      proof: this.serializeProof(proof),
      publicSignals: publicSignals.map((s: string) => this.signalToBuffer(s)),
      newOpponentLP: parseInt(publicSignals[0]),
      isLegal: parseInt(publicSignals[1]) === 1
    };
  }

  // Generate proof for win condition
  async proveWinCondition(
    player1LP: number,
    player2LP: number,
    player1DeckSize: number,
    player2DeckSize: number
  ) {
    const input = {
      player1LP,
      player2LP,
      player1DeckSize,
      player2DeckSize
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      '/circuits/win_condition.wasm',
      '/circuits/win_condition_final.zkey'
    );

    return {
      proof: this.serializeProof(proof),
      publicSignals: publicSignals.map((s: string) => this.signalToBuffer(s)),
      winner: parseInt(publicSignals[0]), // 1 = player1, 2 = player2
      winReason: parseInt(publicSignals[1]) // 0 = LP, 1 = deck out
    };
  }

  // Serialize proof for Soroban
  private serializeProof(proof: any): {
    pi_a: Buffer;
    pi_b: Buffer;
    pi_c: Buffer;
  } {
    const bigIntToBuffer32 = (value: string): Buffer => {
      const bn = BigInt(value);
      const hex = bn.toString(16).padStart(64, '0');
      return Buffer.from(hex, 'hex');
    };

    const pi_a_x = bigIntToBuffer32(proof.pi_a[0]);
    const pi_a_y = bigIntToBuffer32(proof.pi_a[1]);
    const pi_a = Buffer.concat([pi_a_x, pi_a_y]);

    const pi_b_x1 = bigIntToBuffer32(proof.pi_b[0][1]);
    const pi_b_x2 = bigIntToBuffer32(proof.pi_b[0][0]);
    const pi_b_y1 = bigIntToBuffer32(proof.pi_b[1][1]);
    const pi_b_y2 = bigIntToBuffer32(proof.pi_b[1][0]);
    const pi_b = Buffer.concat([pi_b_x1, pi_b_x2, pi_b_y1, pi_b_y2]);

    const pi_c_x = bigIntToBuffer32(proof.pi_c[0]);
    const pi_c_y = bigIntToBuffer32(proof.pi_c[1]);
    const pi_c = Buffer.concat([pi_c_x, pi_c_y]);

    return { pi_a, pi_b, pi_c };
  }

  private signalToBuffer(signal: string): Buffer {
    const bn = BigInt(signal);
    const hex = bn.toString(16).padStart(64, '0');
    return Buffer.from(hex, 'hex');
  }
}
```

### 3. Usage in Game Logic

```typescript
// In your game component or service
import { ZKCardGameService } from './services/zkCardGameService';

const zkService = new ZKCardGameService();
await zkService.initialize();

// When drawing a card (costs 500 LP)
const drawProof = await zkService.proveCardDraw(
  deckCommitment,
  { id: 5, atk: 1500, def: 1200 },
  remainingDeck, // 39 cards
  currentLP,
  deckSalt
);

// Send proof to contract
await cardGameContract.draw_card({
  session_id: sessionId,
  proof: drawProof.proof,
  public_signals: drawProof.publicSignals
});

// When summoning a card
const summonProof = await zkService.proveCardSummon(
  handCommitment,
  { id: 5, atk: 1500, def: 1200 },
  0, // ATK position
  remainingHand,
  5,
  handSalt
);

await cardGameContract.summon_card({
  session_id: sessionId,
  proof: summonProof.proof,
  public_signals: summonProof.publicSignals
});

// When battling
const battleProof = await zkService.proveBattle(
  1800, // attacker ATK
  1000, // attacker DEF
  1500, // defender ATK
  1200, // defender DEF
  0,    // defender position (ATK)
  8000, // attacker LP
  7500  // defender LP
);

await cardGameContract.battle({
  session_id: sessionId,
  attacker_index: 0,
  defender_index: 1,
  proof: battleProof.proof,
  public_signals: battleProof.publicSignals
});
```

## Soroban Contract Integration

### 1. Add Verification Key Storage

```rust
// In contracts/my-game/src/lib.rs

#[contracttype]
pub struct VerificationKey {
    pub alpha: BytesN<64>,
    pub beta: BytesN<128>,
    pub gamma: BytesN<128>,
    pub delta: BytesN<128>,
    pub ic: Vec<BytesN<64>>,
}

#[contracttype]
pub enum DataKey {
    // ... existing keys
    WinConditionVK,
    BattleCalcVK,
    CardDrawVK,
    CardSummonVK,
    DirectAttackVK,
    DeckShuffleVK,
}

// Set verification keys (admin only)
pub fn set_win_vk(env: Env, vk: VerificationKey) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();
    env.storage().instance().set(&DataKey::WinConditionVK, &vk);
}

pub fn set_battle_vk(env: Env, vk: VerificationKey) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();
    env.storage().instance().set(&DataKey::BattleCalcVK, &vk);
}

// ... similar for other circuits
```

### 2. Add Proof Verification Functions

```rust
use soroban_sdk::crypto::groth16::{verify_groth16, VerifierProof};

fn verify_battle_proof(
    env: &Env,
    proof: Groth16Proof,
    public_signals: Vec<Bytes>,
) -> Result<(), Error> {
    let vk: VerificationKey = env
        .storage()
        .instance()
        .get(&DataKey::BattleCalcVK)
        .ok_or(Error::InvalidProof)?;

    let verifier_proof = VerifierProof {
        pi_a: proof.pi_a,
        pi_b: proof.pi_b,
        pi_c: proof.pi_c,
    };

    let is_valid = verify_groth16(env, &vk, &verifier_proof, &public_signals)
        .map_err(|_| Error::InvalidProof)?;

    if !is_valid {
        return Err(Error::InvalidProof);
    }

    Ok(())
}
```

### 3. Update Game Functions

```rust
pub fn battle(
    env: Env,
    session_id: u32,
    attacker_index: u32,
    defender_index: u32,
    proof: Groth16Proof,
    public_signals: Vec<Bytes>,
) -> Result<(), Error> {
    // Verify the ZK proof
    Self::verify_battle_proof(&env, proof, public_signals.clone())?;
    
    // Extract results from public signals
    let new_attacker_lp = Self::bytes_to_i32(&public_signals.get(0).unwrap());
    let new_defender_lp = Self::bytes_to_i32(&public_signals.get(1).unwrap());
    let attacker_destroyed = Self::bytes_to_u32(&public_signals.get(2).unwrap()) == 1;
    let defender_destroyed = Self::bytes_to_u32(&public_signals.get(3).unwrap()) == 1;
    
    // Update game state based on proof results
    // ...
}
```

## Testing

### 1. Test Circuit Locally

```bash
cd circuits/my-game
npm test
```

### 2. Test Frontend Integration

```typescript
// In your test file
import { ZKCardGameService } from './services/zkCardGameService';

test('should generate valid battle proof', async () => {
  const zkService = new ZKCardGameService();
  await zkService.initialize();
  
  const result = await zkService.proveBattle(
    1800, 1000, 1500, 1200, 0, 8000, 7500
  );
  
  expect(result.proof).toBeDefined();
  expect(result.newAttackerLP).toBe(8000);
  expect(result.newDefenderLP).toBe(7700); // 8000 - 300 damage
  expect(result.defenderDestroyed).toBe(true);
});
```

## Deployment Checklist

- [ ] Build all circuits: `npm run setup`
- [ ] Copy circuit files to frontend public folder
- [ ] Deploy Soroban contract with verification keys
- [ ] Test proof generation in frontend
- [ ] Test proof verification in contract
- [ ] Verify gas costs are acceptable
- [ ] Test full game flow with ZK proofs

## Performance Considerations

- **Proof Generation Time**: ~1-3 seconds per proof
- **Proof Size**: ~200-300 bytes
- **Gas Cost**: ~50,000-100,000 gas per verification
- **Circuit Constraints**:
  - Win Condition: ~150 constraints
  - Battle Calc: ~400 constraints
  - Card Draw: ~1,000 constraints (39 cards with grouped hashing)
  - Card Summon: ~200 constraints
  - Direct Attack: ~50 constraints
  - Deck Shuffle: ~1,500 constraints (40 cards with grouped hashing)

## Security Notes

1. **Never expose private inputs** (salts, full deck) to the blockchain
2. **Always verify proofs on-chain** before updating game state
3. **Use unique salts** for each game session
4. **Validate public signals** match expected game state
5. **Rate limit proof submissions** to prevent spam

## Troubleshooting

### Proof generation fails
- Check WASM and zkey files are accessible
- Verify input format matches circuit expectations
- Check browser console for detailed errors

### Proof verification fails on-chain
- Ensure verification key is set correctly
- Verify public signals are in correct order
- Check proof serialization format

### Performance issues
- Consider caching Poseidon instance
- Pre-load WASM files
- Use Web Workers for proof generation
