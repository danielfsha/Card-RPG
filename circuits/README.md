# ZK Circuits for Yu-Gi-Oh! x Dead Man's Draw

This folder contains the Circom circuits used to implement Zero-Knowledge mechanics for the game. We utilize ZK proofs to enable trustless multiplayer, hiding deck orders and hands while enforcing game rules on-chain.

## Structure

- `src/utils/`: Generic cryptography circuits (Merkle Trees, Commitments).
- `src/game/`: Game-specific logic (Draw validation, Battle mechanics).
- `src/main.circom`: Entry point for compilation.

## implemented Circuits

### 1. Deck Commitment (Merkle Tree)

Decks are committed as Merkle Trees. The root is stored on the smart contract.

- **Source**: `src/utils/merkle.circom`
- **Use**: Proves a card drawn belongs to the deck without revealing the entire deck order.

### 2. Hand Privacy (Pedersen Commitment)

Cards in hand are protected via Pedersen Commitments (`Hash(Card + Blinding)`).

- **Source**: `src/utils/commitment.circom`
- **Use**: Players reveal the commitment when playing a card; the circuit/contract verifies it matches the one stored upon drawing.

### 3. Provable Draws (Safe Draw Logic)

Implements the "Push-Your-Luck" mechanic.

- **Source**: `src/game/draw.circom`
- **Function**: Proves that a newly drawn card does not share a suit with any currently active cards in the Play Area.
- **Inputs**:
  - `deckRoot` (Public): Commitment of the deck.
  - `currentSuitsMask` (Public): Bitmask of active suits.
  - `cardValue` (Private): The card being drawn.
  - `pathElements/Indices` (Private): Merkle proof of the card.
- **Outputs**:
  - `newSuitsMask`: Updated state if successful.
  - `isBust`: Flag for bust condition.

### 4. Battle Resolution

Verifies ATK/DEF comparisons for Atomic Battle resolution.

- **Source**: `src/game/battle.circom`
- **Function**: Calculates damage and winner deterministically.

## Usage

### Prerequisites

- Node.js
- Circom 2.0+
- SnarkJS

### Installation

```bash
npm install
```

### Compilation

To compile the Draw circuit (Main):

```bash
# Compile circuit
circom src/main.circom --r1cs --wasm --sym --c

# Generate zkey (setup)
snarkjs groth16 setup main.r1cs powersOfTau28_hez_final_12.ptau circuit_0000.zkey
snarkjs zkey contribute circuit_0000.zkey circuit_final.zkey --name="Contributor" -v -e="Random"
snarkjs zkey export verificationkey circuit_final.zkey verification_key.json
```

### Testing

Use `snarkjs` to generate proofs with example inputs (`input.json`).

```json
{
    "deckRoot": "1234...",
    "currentSuitsMask": 0,
    "cardValue": 101,
    "pathElements": [...],
    "pathIndices": [...]
}
```
