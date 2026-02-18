const { buildPoseidon } = require("circomlibjs");
const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

async function testVRF() {
  console.log("\n=== Testing VRF Circuit ===\n");

  const poseidon = await buildPoseidon();

  // Test Case 1: Basic VRF with two seeds
  console.log("Test 1: Basic VRF dealer selection");
  const player1Seed = BigInt("12345678901234567890");
  const player2Seed = BigInt("98765432109876543210");

  const input = {
    player1_seed: poseidon.F.toString(player1Seed),
    player2_seed: poseidon.F.toString(player2Seed),
  };

  try {
    const wasmPath = path.join(__dirname, "../build/vrf_js/vrf.wasm");
    const zkeyPath = path.join(__dirname, "../vrf_final.zkey");

    if (!fs.existsSync(wasmPath)) {
      console.log("❌ WASM file not found. Run 'npm run compile:vrf' first");
      return false;
    }

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasmPath,
      zkeyPath
    );

    console.log("✅ Proof generated successfully");
    console.log("Dealer button:", publicSignals[0], "(0=player1, 1=player2)");

    // Verify the proof
    const vkeyPath = path.join(__dirname, "../vrf_verification_key.json");
    if (fs.existsSync(vkeyPath)) {
      const vkey = JSON.parse(fs.readFileSync(vkeyPath, "utf8"));
      const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
      console.log("Proof verification:", verified ? "✅ PASSED" : "❌ FAILED");
    }

    // Test Case 2: Determinism - same seeds should give same result
    console.log("\nTest 2: Determinism check");
    const { publicSignals: signals2 } = await snarkjs.groth16.fullProve(
      input,
      wasmPath,
      zkeyPath
    );
    const isDeterministic = publicSignals[0] === signals2[0];
    console.log(
      "Determinism:",
      isDeterministic ? "✅ PASSED" : "❌ FAILED"
    );

    // Test Case 3: Different seeds give potentially different results
    console.log("\nTest 3: Different seeds");
    const input3 = {
      player1_seed: poseidon.F.toString(BigInt("11111111111111111111")),
      player2_seed: poseidon.F.toString(BigInt("22222222222222222222")),
    };
    const { publicSignals: signals3 } = await snarkjs.groth16.fullProve(
      input3,
      wasmPath,
      zkeyPath
    );
    console.log("Dealer button (different seeds):", signals3[0]);
    console.log("✅ Test completed");

    return true;
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    return false;
  }
}

// Run tests
testVRF()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
