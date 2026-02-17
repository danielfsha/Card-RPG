#!/bin/bash

echo "🔐 ZK Poker Trusted Setup"
echo "=========================="

# Check if Powers of Tau file exists
if [ ! -f "powersOfTau28_hez_final_14.ptau" ]; then
    echo "📥 Downloading Powers of Tau (one-time, ~200MB)..."
    curl -o powersOfTau28_hez_final_14.ptau https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to download Powers of Tau"
        echo "Please download manually from:"
        echo "https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau"
        exit 1
    fi
fi

echo "🔑 Generating proving key..."
npx snarkjs groth16 setup build/poker_game.r1cs powersOfTau28_hez_final_14.ptau poker_game_0000.zkey

echo "🎲 Contributing to ceremony (adds randomness)..."
echo "random entropy" | npx snarkjs zkey contribute poker_game_0000.zkey poker_game_final.zkey --name="First contribution"

echo "📋 Exporting verification key..."
npx snarkjs zkey export verificationkey poker_game_final.zkey verification_key.json

echo "📦 Copying artifacts to frontend..."
cp poker_game_final.zkey ../../pocker/public/circuits/
cp verification_key.json ../../pocker/public/circuits/

echo "✅ Trusted setup complete!"
echo ""
echo "Generated files:"
echo "  - poker_game_final.zkey (proving key)"
echo "  - verification_key.json (for contract)"
echo ""
echo "Next steps:"
echo "  1. Deploy contract: bun run deploy pocker"
echo "  2. Set verification key in contract"
echo "  3. Test full game flow"
