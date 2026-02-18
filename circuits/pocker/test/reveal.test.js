const { buildPoseidon } = require("circomlibjs");
const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

async function testReveal() {
  console.log("\n=== Testing Community Card Reveal Circuit ===\n");

  const poseidon = await buildPoseidon();

  const wasmPath = path.join(__dirname, "../build/reveal_js/reveal.wasm");
  const zkeyPath = path.join(__dirname, "../reveal_final.zkey");

  if (!fs.existsSync(wasmPath)) {
    console.log("❌ WASM file not found. Run 'npm run compile:community-reveal' first");
    return false;
  }

  // Create 5 community cards
  const communityCards = [10, 23, 35, 42, 51]; // Example cards
  const revealSalt = BigInt("999888777666555444");

  // Create commitment
  const commitment = poseidon([
    ...communityCards.map(c => poseidon.F.e(c)),
    poseidon.F.e(revealSalt)
  ]);

  // Test Case 1: Reveal first card (flop card 1)
  console.log("Test 1: Reveal first community card");
  try {
    const input = {
      community_commitment: poseidon.F.toString(commitment),
      card_index: "0",
      revealed_cards: communityCards.map(c => c.toString()),
      reveal_salt: poseidon.F.toString(revealSalt),
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasmPath,
      zkeyPath
    );

    console.log("✅ Proof generated successfully");
    console.log("Revealed card:", publicSignals[0]);
    console.log("Expected:", communityCards[0]);
    console.log(publicSignals[0] === communityCards[0].toString() ? "✅ PASSED" : "❌ FAILED");

    // Verify the proof
    const vkeyPath = path.join(__dirname, "../reveal_verification_key.json");
    if (fs.existsSync(vkeyPath)) {
      const vkey = JSON.parse(fs.readFileSync(vkeyPath, "utf8"));
      const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
      console.log("Proof verification:", verified ? "✅ PASSED" : "❌ FAILED");
    }
  } catch (error) {
    console.error("❌ Test 1 failed:", error.message);
    return false;
  }

  // Test Case 2: Reveal turn card (index 3)
  console.log("\nTest 2: Reveal turn card (index 3)");
  try {
    const input = {
      community_commitment: poseidon.F.toString(commitment),
      card_index: "3",
      revealed_cards: communityCards.map(c => c.toString()),
      reveal_salt: poseidon.F.toString(revealSalt),
    };

    const { publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasmPath,
      zkeyPath
    );

    console.log("Revealed card:", publicSignals[0]);
    console.log("Expected:", communityCards[3]);
    console.log(publicSignals[0] === communityCards[3].toString() ? "✅ PASSED" : "❌ FAILED");
  } catch (error) {
    console.error("❌ Test 2 failed:", error.message);
    return false;
  }

  // Test Case 3: Reveal river card (index 4)
  console.log("\nTest 3: Reveal river card (index 4)");
  try {
    const input = {
      community_commitment: poseidon.F.toString(commitment),
      card_index: "4",
      revealed_cards: communityCards.map(c => c.toString()),
      reveal_salt: poseidon.F.toString(revealSalt),
    };

    const { publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasmPath,
      zkeyPath
    );

    console.log("Revealed card:", publicSignals[0]);
    console.log("Expected:", communityCards[4]);
    console.log(publicSignals[0] === communityCards[4].toString() ? "✅ PASSED" : "❌ FAILED");
  } catch (error) {
    console.error("❌ Test 3 failed:", error.message);
    return false;
  }

  console.log("\n✅ All reveal tests completed");
  return true;
}

// Run tests
testReveal()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
