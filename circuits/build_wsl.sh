#!/bin/bash
# Build circuits in WSL
# Run with: wsl bash circuits/build_wsl.sh

set -e

echo "=== Building ZK Circuits for Dead Man's Draw ==="

# Check if circom is installed
if ! command -v circom &> /dev/null; then
    echo "Error: circom not found. Please install circom first:"
    echo "  git clone https://github.com/iden3/circom.git"
    echo "  cd circom && cargo build --release && cargo install --path circom"
    exit 1
fi

# Check if snarkjs is installed
if ! command -v snarkjs &> /dev/null; then
    echo "Error: snarkjs not found. Installing..."
    npm install -g snarkjs
fi

# Create build directory
mkdir -p build/{deck_shuffle,draw_card,game_full}

echo ""
echo "=== Step 1: Compiling Deck Shuffle Circuit ==="
circom src/deck_shuffle.circom \
    --r1cs \
    --wasm \
    --sym \
    --output build/deck_shuffle

echo ""
echo "=== Step 2: Compiling Draw Card Circuit ==="
circom src/draw_card.circom \
    --r1cs \
    --wasm \
    --sym \
    --output build/draw_card

echo ""
echo "=== Circuit Info ==="
echo "Deck Shuffle:"
snarkjs r1cs info build/deck_shuffle/deck_shuffle.r1cs

echo ""
echo "Draw Card:"
snarkjs r1cs info build/draw_card/draw_card.r1cs

echo ""
echo "=== Circuits compiled successfully! ==="
echo ""
echo "Next steps:"
echo "1. Download Powers of Tau:"
echo "   wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau"
echo ""
echo "2. Generate proving keys:"
echo "   cd build/draw_card"
echo "   snarkjs groth16 setup draw_card.r1cs ../../powersOfTau28_hez_final_12.ptau draw_card_0000.zkey"
echo "   snarkjs zkey contribute draw_card_0000.zkey draw_card_final.zkey --name='Contributor' -v"
echo "   snarkjs zkey export verificationkey draw_card_final.zkey verification_key.json"
echo ""
echo "3. Test proof generation:"
echo "   node test_draw_proof.js"
