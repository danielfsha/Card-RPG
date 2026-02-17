# ZK Poker Circuit Artifacts

This directory contains the compiled circuit artifacts for ZK poker proof generation.

## Files

- `poker_game.wasm` - Compiled circuit WASM file for proof generation
- `poker_game_final.zkey` - Proving key (generated during trusted setup)
- `verification_key.json` - Verification key for contract

## Setup

Run the trusted setup ceremony to generate the proving key:

```bash
cd circuits/pocker
chmod +x setup-trusted.sh
./setup-trusted.sh
```

This will:
1. Download Powers of Tau (one-time, ~200MB)
2. Generate the proving key
3. Add randomness contribution
4. Export verification key
5. Copy artifacts to frontend

## Manual Setup

If the script fails, run manually:

```bash
cd circuits/pocker

# Download Powers of Tau (alternative URL)
curl -o powersOfTau28_hez_final_14.ptau https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau

# Generate proving key
npx snarkjs groth16 setup build/poker_game.r1cs powersOfTau28_hez_final_14.ptau poker_game_0000.zkey

# Add randomness
echo "random" | npx snarkjs zkey contribute poker_game_0000.zkey poker_game_final.zkey --name="Contribution"

# Export verification key
npx snarkjs zkey export verificationkey poker_game_final.zkey verification_key.json

# Copy to frontend
cp poker_game_final.zkey ../../pocker/public/circuits/
cp verification_key.json ../../pocker/public/circuits/
```

## Usage

The ZK service (`src/services/zkService.ts`) automatically loads these files for proof generation.

## Circuit Details

- **Constraints**: 764 non-linear, 1253 linear
- **Public Inputs**: 2 (player1_commitment, player2_commitment)
- **Private Inputs**: 12 (cards, salts)
- **Public Outputs**: 3 (player1_ranking, player2_ranking, winner)
