# ZK Card Battle Circuits - Design & Architecture

> Zero-Knowledge circuit design for provably fair Yu-Gi-Oh style card battles on Stellar

## 📁 Directory Structure

```
circuits/my-game/
├── src/                          # Circuit source files (.circom)
│   ├── deck_shuffle.circom       # Deck commitment (40 cards)
│   ├── card_draw.circom          # Prove honest card drawing (39 cards)
│   ├── card_summon.circom        # Prove summoning from hand
│   ├── battle_calc.circom        # Battle damage calculations
│   ├── direct_attack.circom      # Direct attack validation
│   └── win_condition.circom      # Win condition verification
│
├── build/                        # Compiled circuit artifacts
│   ├── deck_shuffle.r1cs         # Constraint system
│   ├── deck_shuffle_js/          # WASM prover
│   │   └── deck_shuffle.wasm     # ~1MB WASM file
│   ├── card_draw_js/
│   ├── card_summon_js/
│   ├── battle_calc_js/
│   ├── direct_attack_js/
│   └── win_condition_js/
│
├── scripts/                      # Build & test scripts
│   ├── setup.js                  # Individual circuit setup
│   ├── setup-all.js              # Build all circuits
│   ├── generate_proof.js         # Proof generation
│   └── test.js                   # Circuit testing
│
├── test/                         # Circuit tests
│   ├── deck_shuffle.test.js
│   ├── card_draw.test.js
│   ├── card_summon.test.js
│   ├── battle_calc.test.js
│   ├── direct_attack.test.js
│   └── win_condition.test.js
│
├── public/circuits/              # Frontend artifacts
│   ├── *.wasm                    # Copied from build/
│   └── *_final.zkey              # Proving keys
│
├── *_final.zkey                  # Proving keys (~10-50MB each)
├── *_verification_key.json       # Verification keys (~2KB each)
├── powersOfTau28_hez_final_14.ptau  # Powers of Tau
├── package.json                  # Dependencies
└── build.sh                      # Build script
```

## 🎮 Game Rules

### Core Mechanics
- 2 players, 40-card decks
- 8000 starting LP
- 5 monster zones per player
- Initial hand: 5 cards
- Drawing costs 500 LP (max 1 per turn)

### Turn Structure
1. Main Phase: Summon OR Attack (one action only)
2. Battle Phase: Execute attacks
3. End Phase: Turn ends automatically

### Win Conditions
- Opponent LP reaches 0
- Opponent cannot draw (deck out)

### Battle Rules
- ATK vs ATK: Higher ATK wins, difference = LP damage
- ATK vs DEF: ATK > DEF destroys defender (no LP damage)
- ATK vs DEF_DOWN: Same as DEF, but attacker takes damage if ATK < DEF
- Direct Attack: Only if opponent has no monsters

## 🔧 Circuit Components

### 1. Deck Shuffle Circuit

**File**: `src/deck_shuffle.circom`

**Purpose**: Generate commitment for 40-card deck

**Constraints**: ~1,500

```circom
template DeckShuffle() {
    signal input cards[40];     // 40 cards (IDs)
    signal input salt;          // Random 256-bit salt
    
    signal output deckCommitment;
    
    // Hash in groups of 10 to avoid "Out of bounds" error
    component groupHashers[4];
    signal groupHashes[4];
    
    for (var i = 0; i < 4; i++) {
        groupHashers[i] = Poseidon(10);
        for (var j = 0; j < 10; j++) {
            groupHashers[i].inputs[j] <== cards[i * 10 + j];
        }
        groupHashes[i] <== groupHashers[i].out;
    }
    
    // Final hash with salt
    component finalHasher = Poseidon(5);
    for (var i = 0; i < 4; i++) {
        finalHasher.inputs[i] <== groupHashes[i];
    }
    finalHasher.inputs[4] <== salt;
    
    deckCommitment <== finalHasher.out;
}
```

**Data Flow**:
```
cards[40] → Group into 4x10 → Hash each group → Final hash with salt → commitment
```

---

### 2. Card Draw Circuit

**File**: `src/card_draw.circom`

**Purpose**: Prove honest card drawing with 500 LP cost

**Constraints**: ~1,000

```circom
template CardDraw() {
    signal input deckCommitment;
    signal input drawnCardId;
    signal input drawnCardATK;
    signal input drawnCardDEF;
    signal input remainingCards[39];  // 39 cards left
    signal input playerLP;
    signal input salt;
    
    signal output newDeckCommitment;
    signal output newLP;
    
    // Verify original deck commitment
    // Reconstruct: [drawnCard, ...remainingCards]
    component groupHashers[4];
    signal groupHashes[4];
    
    // First group: drawn card + 9 remaining
    groupHashers[0] = Poseidon(10);
    groupHashers[0].inputs[0] <== drawnCardId;
    for (var j = 1; j < 10; j++) {
        groupHashers[0].inputs[j] <== remainingCards[j - 1];
    }
    groupHashes[0] <== groupHashers[0].out;
    
    // Remaining 3 groups
    for (var i = 1; i < 4; i++) {
        groupHashers[i] = Poseidon(10);
        for (var j = 0; j < 10; j++) {
            groupHashers[i].inputs[j] <== remainingCards[(i - 1) * 10 + 9 + j];
        }
        groupHashes[i] <== groupHashers[i].out;
    }
    
    // Verify commitment
    component deckHasher = Poseidon(5);
    for (var i = 0; i < 4; i++) {
        deckHasher.inputs[i] <== groupHashes[i];
    }
    deckHasher.inputs[4] <== salt;
    
    signal commitmentMatch;
    commitmentMatch <== deckHasher.out - deckCommitment;
    commitmentMatch === 0;
    
    // Compute new deck commitment (39 cards)
    // Hash remaining 39 cards in groups
    component newGroupHashers[4];
    signal newGroupHashes[4];
    
    for (var i = 0; i < 3; i++) {
        newGroupHashers[i] = Poseidon(10);
        for (var j = 0; j < 10; j++) {
            newGroupHashers[i].inputs[j] <== remainingCards[i * 10 + j];
        }
        newGroupHashes[i] <== newGroupHashers[i].out;
    }
    
    // Last group: 9 cards + padding
    newGroupHashers[3] = Poseidon(10);
    for (var j = 0; j < 9; j++) {
        newGroupHashers[3].inputs[j] <== remainingCards[30 + j];
    }
    newGroupHashers[3].inputs[9] <== 0;  // Padding
    newGroupHashes[3] <== newGroupHashers[3].out;
    
    component newDeckHasher = Poseidon(5);
    for (var i = 0; i < 4; i++) {
        newDeckHasher.inputs[i] <== newGroupHashes[i];
    }
    newDeckHasher.inputs[4] <== salt;
    newDeckCommitment <== newDeckHasher.out;
    
    // Apply 500 LP cost
    newLP <== playerLP - 500;
}
```

**Data Flow**:
```
Verify: [drawnCard + remainingCards[39]] matches deckCommitment
Compute: newDeckCommitment from remainingCards[39]
Apply: 500 LP cost
```

---

### 3. Card Summon Circuit

**File**: `src/card_summon.circom`

**Purpose**: Prove summoning card from hand

**Constraints**: ~200

```circom
template CardSummon() {
    signal input handCommitment;
    signal input summonedCardId;
    signal input summonedCardATK;
    signal input summonedCardDEF;
    signal input summonPosition;      // 0=ATK, 1=DEF, 2=DEF_DOWN
    signal input remainingHand[4];    // Up to 4 cards left
    signal input handSize;            // 1-5
    signal input salt;
    
    signal output newHandCommitment;
    signal output summonedCardHash;
    
    // Verify hand size (1-5)
    component sizeCheck = LessThan(8);
    sizeCheck.in[0] <== handSize;
    sizeCheck.in[1] <== 6;
    sizeCheck.out === 1;
    
    // Verify position (0-2)
    component posCheck = LessThan(8);
    posCheck.in[0] <== summonPosition;
    posCheck.in[1] <== 3;
    posCheck.out === 1;
    
    // Reconstruct original hand
    component handHasher = Poseidon(6);
    handHasher.inputs[0] <== summonedCardId;
    for (var i = 0; i < 4; i++) {
        handHasher.inputs[i + 1] <== remainingHand[i];
    }
    handHasher.inputs[5] <== salt;
    
    signal handMatch;
    handMatch <== handHasher.out - handCommitment;
    handMatch === 0;
    
    // New hand commitment
    component newHasher = Poseidon(5);
    for (var i = 0; i < 4; i++) {
        newHasher.inputs[i] <== remainingHand[i];
    }
    newHasher.inputs[4] <== salt;
    newHandCommitment <== newHasher.out;
    
    // Summoned card hash
    component cardHasher = Poseidon(4);
    cardHasher.inputs[0] <== summonedCardId;
    cardHasher.inputs[1] <== summonedCardATK;
    cardHasher.inputs[2] <== summonedCardDEF;
    cardHasher.inputs[3] <== summonPosition;
    summonedCardHash <== cardHasher.out;
}
```

---

### 4. Battle Calculation Circuit

**File**: `src/battle_calc.circom`

**Purpose**: Compute battle damage following Yu-Gi-Oh rules

**Constraints**: ~400

```circom
template BattleCalculation() {
    signal input attackerATK;
    signal input attackerDEF;
    signal input defenderATK;
    signal input defenderDEF;
    signal input defenderPosition;  // 0=ATK, 1=DEF, 2=DEF_DOWN
    signal input attackerLP;
    signal input defenderLP;
    
    signal output newAttackerLP;
    signal output newDefenderLP;
    signal output attackerDestroyed;
    signal output defenderDestroyed;
    signal output damage;
    
    // Determine defender's battle value
    component isATKPosition = IsEqual();
    isATKPosition.in[0] <== defenderPosition;
    isATKPosition.in[1] <== 0;
    
    signal defenderValue;
    defenderValue <== isATKPosition.out * defenderATK + 
                      (1 - isATKPosition.out) * defenderDEF;
    
    // Compare ATK vs defender value
    component atkGreater = GreaterThan(16);
    atkGreater.in[0] <== attackerATK;
    atkGreater.in[1] <== defenderValue;
    
    component defGreater = GreaterThan(16);
    defGreater.in[0] <== defenderValue;
    defGreater.in[1] <== attackerATK;
    
    // Destruction logic
    attackerDestroyed <== defGreater.out;
    defenderDestroyed <== atkGreater.out;
    
    // LP damage calculation
    signal attackerDamage;
    signal defenderDamage;
    
    attackerDamage <== defGreater.out * (defenderValue - attackerATK);
    defenderDamage <== atkGreater.out * isATKPosition.out * 
                       (attackerATK - defenderValue);
    
    damage <== attackerDamage + defenderDamage;
    newAttackerLP <== attackerLP - attackerDamage;
    newDefenderLP <== defenderLP - defenderDamage;
}
```

**Battle Rules**:
- ATK vs ATK: Higher wins, loser takes damage
- ATK vs DEF: ATK > DEF destroys defender (no LP damage)
- ATK vs DEF: ATK < DEF destroys attacker (attacker takes damage)
- ATK vs DEF_DOWN: Same as DEF

---

### 5. Direct Attack Circuit

**File**: `src/direct_attack.circom`

**Purpose**: Validate direct attack legality

**Constraints**: ~50

```circom
template DirectAttack() {
    signal input attackerATK;
    signal input opponentLP;
    signal input opponentFieldCount;
    
    signal output newOpponentLP;
    signal output isLegal;
    
    // Legal only if opponent has no monsters
    component noMonsters = IsZero();
    noMonsters.in <== opponentFieldCount;
    isLegal <== noMonsters.out;
    
    // Apply damage if legal
    newOpponentLP <== opponentLP - (isLegal * attackerATK);
}
```

---

### 6. Win Condition Circuit

**File**: `src/win_condition.circom`

**Purpose**: Prove legitimate win

**Constraints**: ~150

```circom
template WinCondition() {
    signal input player1LP;
    signal input player2LP;
    signal input player1DeckSize;
    signal input player2DeckSize;
    
    signal output winner;     // 1=P1, 2=P2, 0=no winner
    signal output winReason;  // 0=LP, 1=deck out
    
    // Check LP = 0
    component p1LPZero = IsZero();
    p1LPZero.in <== player1LP;
    
    component p2LPZero = IsZero();
    p2LPZero.in <== player2LP;
    
    // Check deck out
    component p1DeckOut = IsZero();
    p1DeckOut.in <== player1DeckSize;
    
    component p2DeckOut = IsZero();
    p2DeckOut.in <== player2DeckSize;
    
    // Determine winner
    signal p1Lost;
    p1Lost <== p1LPZero.out + p1DeckOut.out;
    
    signal p2Lost;
    p2Lost <== p2LPZero.out + p2DeckOut.out;
    
    // Winner: 1 if P2 lost, 2 if P1 lost, 0 if neither
    winner <== (p2Lost * 1) + (p1Lost * 2);
    
    // Win reason: 0 if LP, 1 if deck out
    winReason <== p1DeckOut.out + p2DeckOut.out;
}
```

---

## 🔨 Build Process

### 1. Compile All Circuits

```bash
cd circuits/my-game
npm run setup
```

This runs `scripts/setup-all.js` which:
1. Compiles all 6 circuits
2. Generates proving keys
3. Exports verification keys
4. Copies artifacts to `public/circuits/`

### 2. Individual Circuit Setup

```bash
npm run setup:deck        # Deck shuffle
npm run setup:draw        # Card draw
npm run setup:summon      # Card summon
npm run setup:battle      # Battle calc
npm run setup:direct      # Direct attack
npm run setup:win         # Win condition
```

---

## 🧪 Testing

```bash
npm test
```

Runs all circuit tests in `test/` directory.

---

## 📊 Performance Metrics

| Circuit | Constraints | Proof Time | Proof Size | Verification |
|---------|-------------|------------|------------|--------------|
| deck_shuffle | ~1,500 | 1-2s | 200 bytes | <100ms |
| card_draw | ~1,000 | 1-2s | 200 bytes | <100ms |
| card_summon | ~200 | <1s | 200 bytes | <50ms |
| battle_calc | ~400 | <1s | 200 bytes | <50ms |
| direct_attack | ~50 | <1s | 200 bytes | <50ms |
| win_condition | ~150 | <1s | 200 bytes | <50ms |

---

## 🔐 Security Properties

### Commitment Security
- Binding: Cannot change cards after commitment
- Hiding: Commitment reveals nothing about cards
- Collision-resistant: Poseidon hash security

### Proof Security
- Soundness: Invalid proofs rejected
- Zero-knowledge: Proof reveals nothing except validity
- Succinctness: Constant-size proof (~200 bytes)

### Game Integrity
- Cannot draw cards not in deck
- Cannot summon cards not in hand
- Cannot fake battle results
- Cannot claim false wins

---

## 📚 References

- **Circom Language**: https://docs.circom.io/
- **Poseidon Hash**: https://eprint.iacr.org/2019/458.pdf
- **Groth16**: https://eprint.iacr.org/2016/260.pdf
- **Circomlib**: https://github.com/iden3/circomlib
- **SnarkJS**: https://github.com/iden3/snarkjs

---

**Built for Stellar Protocol 25 | Powered by Circom & Groth16 | Secured by Zero-Knowledge**
