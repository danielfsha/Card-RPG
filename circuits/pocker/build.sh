#!/bin/bash

# ZK Poker Circuit Build Script
# Compiles circuits, performs trusted setup, and generates verification keys

set -e  # Exit on error

echo "🎰 ZK Poker Circuit Build Pipeline"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if circom is installed
if ! command -v circom &> /dev/null; then
    echo -e "${RED}❌ circom not found. Please install circom first.${NC}"
    echo "Visit: https://docs.circom.io/getting-started/installation/"
    exit 1
fi

# Check if snarkjs is installed
if ! command -v snarkjs &> /dev/null; then
    echo -e "${RED}❌ snarkjs not found. Installing...${NC}"
    npm install -g snarkjs
fi

# Create build directory
mkdir -p build

echo -e "${YELLOW}Step 1: Installing dependencies${NC}"
npm install

echo ""
echo -e "${YELLOW}Step 2: Compiling circuits${NC}"
echo "Compiling card_commitment.circom..."
circom src/card_commitment.circom --r1cs --wasm --sym -o build

echo "Compiling card_reveal.circom..."
circom src/card_reveal.circom --r1cs --wasm --sym -o build

echo "Compiling hand_ranking.circom..."
circom src/hand_ranking.circom --r1cs --wasm --sym -o build

echo "Compiling poker_game.circom (main circuit)..."
circom src/poker_game.circom --r1cs --wasm --sym -o build

echo -e "${GREEN}✅ All circuits compiled successfully${NC}"

echo ""
echo -e "${YELLOW}Step 3: Generating circuit info${NC}"
snarkjs r1cs info build/poker_game.r1cs

echo ""
echo -e "${YELLOW}Step 4: Powers of Tau ceremony${NC}"
if [ ! -f "pot14_final.ptau" ]; then
    echo "Generating Powers of Tau (this may take a few minutes)..."
    snarkjs powersoftau new bn128 14 pot14_0000.ptau -v
    snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau --name="First contribution" -e="$(date +%s)" -v
    snarkjs powersoftau prepare phase2 pot14_0001.ptau pot14_final.ptau -v
    rm pot14_0000.ptau pot14_0001.ptau
    echo -e "${GREEN}✅ Powers of Tau ceremony complete${NC}"
else
    echo -e "${GREEN}✅ Using existing Powers of Tau file${NC}"
fi

echo ""
echo -e "${YELLOW}Step 5: Generating proving and verification keys${NC}"
echo "Setting up poker_game circuit..."
snarkjs groth16 setup build/poker_game.r1cs pot14_final.ptau poker_game_0000.zkey

echo "Contributing to circuit-specific setup..."
snarkjs zkey contribute poker_game_0000.zkey poker_game_final.zkey --name="Poker contribution" -e="$(date +%s)" -v

echo "Exporting verification key..."
snarkjs zkey export verificationkey poker_game_final.zkey verification_key.json

echo "Exporting Solidity verifier (reference)..."
snarkjs zkey export solidityverifier poker_game_final.zkey verifier.sol

rm poker_game_0000.zkey

echo -e "${GREEN}✅ Keys generated successfully${NC}"

echo ""
echo -e "${YELLOW}Step 6: Generating test proof${NC}"
node scripts/generate_proof.js

echo ""
echo -e "${GREEN}🎉 Build complete!${NC}"
echo ""
echo "Generated files:"
echo "  - build/poker_game.r1cs (constraint system)"
echo "  - build/poker_game_js/poker_game.wasm (WASM prover)"
echo "  - poker_game_final.zkey (proving key, ~50MB)"
echo "  - verification_key.json (verification key, ~2KB)"
echo "  - verifier.sol (Solidity verifier reference)"
echo ""
echo "Next steps:"
echo "  1. Copy WASM and zkey to frontend: npm run copy-artifacts"
echo "  2. Build Soroban contract: cd ../../ && bun run build pocker"
echo "  3. Deploy to testnet: bun run deploy pocker"
