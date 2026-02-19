#!/bin/bash

# ZK Interstellar Circuit Build Script
# Compiles circuits, performs trusted setup, and generates verification keys

set -e  # Exit on error

echo "🚀 ZK Interstellar Circuit Build Pipeline"
echo "=========================================="
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
echo "Compiling spawn.circom..."
circom src/spawn.circom --r1cs --wasm --sym -o build

echo "Compiling movement.circom..."
circom src/movement.circom --r1cs --wasm --sym -o build

echo "Compiling shooting.circom (main circuit)..."
circom src/shooting.circom --r1cs --wasm --sym -o build

echo "Compiling damage.circom..."
circom src/damage.circom --r1cs --wasm --sym -o build

echo "Compiling item_collection.circom..."
circom src/item_collection.circom --r1cs --wasm --sym -o build

echo "Compiling win_condition.circom..."
circom src/win_condition.circom --r1cs --wasm --sym -o build

echo -e "${GREEN}✅ All circuits compiled successfully${NC}"

echo ""
echo -e "${YELLOW}Step 3: Generating circuit info${NC}"
snarkjs r1cs info build/shooting.r1cs

echo ""
echo -e "${YELLOW}Step 4: Powers of Tau ceremony${NC}"
PTAU_FILE="powersOfTau28_hez_final_14.ptau"

if [ ! -f "$PTAU_FILE" ]; then
    echo "Downloading Powers of Tau file (this is a one-time download)..."
    echo "This file is from the Perpetual Powers of Tau ceremony."
    curl -L https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau -o $PTAU_FILE
    echo -e "${GREEN}✅ Powers of Tau file downloaded${NC}"
else
    echo -e "${GREEN}✅ Using existing Powers of Tau file${NC}"
fi

echo ""
echo -e "${YELLOW}Step 5: Generating proving and verification keys${NC}"
echo "Setting up shooting circuit (main game circuit)..."
snarkjs groth16 setup build/shooting.r1cs $PTAU_FILE shooting_0000.zkey

echo "Contributing to circuit-specific setup..."
snarkjs zkey contribute shooting_0000.zkey shooting_final.zkey --name="Interstellar contribution" -e="$(date +%s)" -v

echo "Exporting verification key..."
snarkjs zkey export verificationkey shooting_final.zkey verification_key.json

echo "Exporting Solidity verifier (reference)..."
snarkjs zkey export solidityverifier shooting_final.zkey verifier.sol

rm shooting_0000.zkey

echo -e "${GREEN}✅ Keys generated successfully${NC}"

echo ""
echo -e "${YELLOW}Step 6: Generating test proof${NC}"
node scripts/generate_proof.js

echo ""
echo -e "${GREEN}🎉 Build complete!${NC}"
echo ""
echo "Generated files:"
echo "  - build/shooting.r1cs (constraint system)"
echo "  - build/shooting_js/shooting.wasm (WASM prover)"
echo "  - shooting_final.zkey (proving key)"
echo "  - verification_key.json (verification key)"
echo "  - verifier.sol (Solidity verifier reference)"
echo ""
echo "Next steps:"
echo "  1. Copy WASM and zkey to frontend: npm run copy-artifacts"
echo "  2. Build Soroban contract: cd ../../ && bun run build interstellar"
echo "  3. Deploy to testnet: bun run deploy interstellar"
