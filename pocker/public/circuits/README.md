# ZK Poker Circuit Artifacts

This directory contains the compiled circuit artifacts for ZK poker proof generation.

## Files

- `poker_game.wasm` - Compiled circuit WASM file for proof generation
- `poker_game_final.zkey` - Proving key (generated during trusted setup)

## Setup

To generate the proving key, run the trusted setup ceremony:

```bash
cd circuits/pocker

# Download Powers of Tau (one-time)
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau

# Generate proving key
snarkjs groth16 setup build/poker_game.r1cs powersOfTau28_hez_final_14.ptau poker_game_final.zkey

# Copy to frontend
cp poker_game_final.zkey ../../pocker/public/circuits/
```

## Usage

The ZK service (`src/services/zkService.ts`) automatically loads these files for proof generation.

## Circuit Details

- **Constraints**: 764 non-linear, 1253 linear
- **Public Inputs**: 2 (player1_commitment, player2_commitment)
- **Private Inputs**: 12 (cards, salts)
- **Public Outputs**: 3 (player1_ranking, player2_ranking, winner)
