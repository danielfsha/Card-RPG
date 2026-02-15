# ZK Circuit Setup Guide

Complete guide for setting up, building, and testing the ZK circuits for production deployment.

## Prerequisites

### 1. Install Rust & Circom

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
source $HOME/.cargo/env

# Clone and build Circom
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom

# Verify installation
circom --version  # Should show 2.0.0 or higher
```

### 2. Install Node.js Dependencies

```bash
cd circuits
npm install
npm install -g snarkjs
```

### 3. Download Powers of Tau

```bash
# Download ceremony file (one-time, ~200MB)
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau
```

## Build Process

### Step 1: Compile Circuits

```bash
# Build all circuits
npm run build

# This creates:
# - build/draw/draw_only.r1cs
# - build/draw/draw_only.wasm
# - build/battle/battle_only.r1cs
# - build/battle/battle_only.wasm
# - build/main/zk_card_rpg.r1cs
# - build/main/zk_card_rpg.wasm
```

### Step 2: Generate Proving Keys

```bash
# Draw circuit
cd build/draw
snarkjs groth16 setup draw_only.r1cs ../../powersOfTau28_hez_final_12.ptau draw_0000.zkey

# Contribute randomness (repeat for multiple contributors in production)
snarkjs zkey contribute draw_0000.zkey draw_0001.zkey \
  --name="First contributor" \
  --entropy="$(openssl rand -hex 32)" \
  -v

# Export final key
snarkjs zkey export verificationkey draw_0001.zkey verification_key.json

# Export Solidity verifier (for reference)
snarkjs zkey export solidityverifier draw_0001.zkey verifier.sol

cd ../..
```

```bash
# Battle circuit
cd build/battle
snarkjs groth16 setup battle_only.r1cs ../../powersOfTau28_hez_final_12.ptau battle_0000.zkey
snarkjs zkey contribute battle_0000.zkey battle_0001.zkey \
  --name="First contributor" \
  --entropy="$(openssl rand -hex 32)" \
  -v
snarkjs zkey export verificationkey battle_0001.zkey verification_key.json
cd ../..
```

```bash
# Main circuit
cd build/main
snarkjs groth16 setup zk_card_rpg.r1cs ../../powersOfTau28_hez_final_12.ptau main_0000.zkey
snarkjs zkey contribute main_0000.zkey main_0001.zkey \
  --name="First contributor" \
  --entropy="$(openssl rand -hex 32)" \
  -v
snarkjs zkey export verificationkey main_0001.zkey verification_key.json
cd ../..
```

### Step 3: Test Proof Generation

Create test input file:

```bash
cat > test_draw_input.json << 'EOF'
{
  "deckRoot": "12345678901234567890123456789012",
  "currentSuitsMask": "0",
  "cardIndex": "0",
  "cardValue": "257",
  "pathElements": ["0","0","0","0","0","0"],
  "pathIndices": ["0","0","0","0","0","0"]
}
EOF
```

Generate and verify proof:

```bash
# Generate witness
node build/draw/draw_only_js/generate_witness.js \
  build/draw/draw_only_js/draw_only.wasm \
  test_draw_input.json \
  witness.wtns

# Generate proof
snarkjs groth16 prove \
  build/draw/draw_0001.zkey \
  witness.wtns \
  proof.json \
  public.json

# Verify proof
snarkjs groth16 verify \
  build/draw/verification_key.json \
  public.json \
  proof.json

# Should output: [INFO]  snarkJS: OK!
```

## Production Deployment

### Multi-Party Ceremony

For production, run a multi-party trusted setup ceremony:

```bash
# Coordinator generates initial key
snarkjs zkey new circuit.r1cs powersOfTau28_hez_final_12.ptau circuit_0000.zkey

# Contributor 1
snarkjs zkey contribute circuit_0000.zkey circuit_0001.zkey \
  --name="Contributor 1" \
  --entropy="$(openssl rand -hex 32)"

# Contributor 2
snarkjs zkey contribute circuit_0001.zkey circuit_0002.zkey \
  --name="Contributor 2" \
  --entropy="$(openssl rand -hex 32)"

# ... repeat for N contributors

# Verify contributions
snarkjs zkey verify circuit.r1cs powersOfTau28_hez_final_12.ptau circuit_000N.zkey

# Beacon (final randomness from public source)
snarkjs zkey beacon circuit_000N.zkey circuit_final.zkey \
  0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f \
  10 \
  -n="Final Beacon"
```

### Export for Stellar

```bash
# Export verification key in format for Stellar contract
snarkjs zkey export json circuit_final.zkey vkey.json

# Convert to Stellar-compatible format
node scripts/export_stellar_vkey.js vkey.json > stellar_vkey.txt
```

## Integration Testing

### Test Draw Proof

```javascript
const snarkjs = require('snarkjs');
const fs = require('fs');

async function testDrawProof() {
    const input = {
        deckRoot: "12345678901234567890123456789012",
        currentSuitsMask: "0",
        cardIndex: "0",
        cardValue: "257", // Card with suit=1 (bits 8-11)
        pathElements: Array(6).fill("0"),
        pathIndices: Array(6).fill("0")
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        "build/draw/draw_only.wasm",
        "build/draw/draw_0001.zkey"
    );

    console.log("Public Signals:", publicSignals);
    // [0] = newSuitsMask (should be 2 = 0b0010)
    // [1] = isBust (should be 0)
    // [2] = drawnSuit (should be 1)

    const vkey = JSON.parse(fs.readFileSync("build/draw/verification_key.json"));
    const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    
    console.log("Verification:", verified ? "✓ PASS" : "✗ FAIL");
}

testDrawProof();
```

### Test Battle Proof

```javascript
async function testBattleProof() {
    const input = {
        attackerATK: "2500",
        defenderATK: "2000",
        defenderDEF: "1500",
        defenderPos: "0" // Attack position
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        "build/battle/battle_only.wasm",
        "build/battle/battle_0001.zkey"
    );

    console.log("Public Signals:", publicSignals);
    // [0] = destroyAttacker (should be 0)
    // [1] = destroyDefender (should be 1)
    // [2] = damageToAttacker (should be 0)
    // [3] = damageToDefender (should be 500)

    const vkey = JSON.parse(fs.readFileSync("build/battle/verification_key.json"));
    const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    
    console.log("Verification:", verified ? "✓ PASS" : "✗ FAIL");
}

testBattleProof();
```

## Performance Benchmarks

Run benchmarks to measure proof generation time:

```bash
# Install hyperfine
cargo install hyperfine

# Benchmark draw proof
hyperfine --warmup 3 \
  'node build/draw/draw_only_js/generate_witness.js build/draw/draw_only_js/draw_only.wasm test_draw_input.json witness.wtns && snarkjs groth16 prove build/draw/draw_0001.zkey witness.wtns proof.json public.json'

# Benchmark battle proof
hyperfine --warmup 3 \
  'node build/battle/battle_only_js/generate_witness.js build/battle/battle_only_js/battle_only.wasm test_battle_input.json witness.wtns && snarkjs groth16 prove build/battle/battle_0001.zkey witness.wtns proof.json public.json'
```

## Troubleshooting

### Circuit Compilation Errors

```bash
# Check Circom version
circom --version

# Verify circomlib installation
ls node_modules/circomlib/circuits/

# Clean and rebuild
npm run clean
npm run build
```

### Proof Generation Failures

```bash
# Verify input format
cat test_draw_input.json | jq .

# Check witness generation
node build/draw/draw_only_js/generate_witness.js \
  build/draw/draw_only_js/draw_only.wasm \
  test_draw_input.json \
  witness.wtns \
  --verbose

# Inspect R1CS constraints
snarkjs r1cs info build/draw/draw_only.r1cs
snarkjs r1cs print build/draw/draw_only.r1cs draw_only.sym
```

### Memory Issues

For large circuits, increase Node.js memory:

```bash
export NODE_OPTIONS="--max-old-space-size=8192"
```

## Security Checklist

- [ ] Multi-party trusted setup completed
- [ ] All contributors used independent entropy sources
- [ ] Verification keys backed up securely
- [ ] Circuits audited for under-constrained bugs
- [ ] Test vectors cover edge cases
- [ ] Proof generation benchmarked
- [ ] Integration tests pass
- [ ] Documentation complete

## Next Steps

1. Deploy verification keys to Stellar contract
2. Integrate proof generation in frontend
3. Test end-to-end game flow
4. Run security audit
5. Launch testnet beta

## Support

For issues or questions:
- GitHub Issues: [repo]/issues
- Discord: #zk-gaming
- Docs: [repo]/docs
