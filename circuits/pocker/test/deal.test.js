const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

async function testDeal() {
  console.log("\n=== Testing Card Deal Circuit ===\n");

  const wasmPath = path.join(__dirname, "../build/deal_js/deal.wasm");
  const zkeyPath = path.join(__dirname, "../deal_final.zkey");

  if (!fs.existsSync(wasmPath)) {
    console.log("❌ WASM file not found. Run 'npm run compile:deal' first");
    return false;
  }

  // Create a shuffled deck (0-51)
  const shuffledDeck = Array.from({ length: 52 }, (_, i) => i.toString());

  // Test Case 1: Deal from top of deck
  console.log("Test 1: Deal 9 cards from top of deck");
  try {
    const input = {
      shuffled_deck: shuffledDeck,
      deal_positions: ["0", "1", "2", "3", "4", "5", "6", "7", "8"],
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasmPath,
      zkeyPath
    );

    console.log("✅ Proof generated successfully");
    console.log("Dealt cards:", publicSignals.slice(0, 9));
    console.log("Player 1 hole commitment:", publicSignals[9]);
    console.log("Player 2 hole commitment:", publicSignals[10]);
    console.log("Community commitment:", publicSignals[11]);

    // Verify the proof
    const vkeyPath = path.join(__dirname, "../deal_verification_key.json");
    if (fs.existsSync(vkeyPath)) {
      const vkey = JSON.parse(fs.readFileSync(vkeyPath, "utf8"));
      const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
      console.log("Proof verification:", verified ? "✅ PASSED" : "❌ FAILED");
    }

    return true;
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    return false;
  }
}

// Run tests
testDeal()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
