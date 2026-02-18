const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

async function testBetting() {
  console.log("\n=== Testing Betting Validation Circuit ===\n");

  const wasmPath = path.join(__dirname, "../build/betting_js/betting.wasm");
  const zkeyPath = path.join(__dirname, "../betting_final.zkey");

  if (!fs.existsSync(wasmPath)) {
    console.log("❌ WASM file not found. Run 'npm run compile:betting' first");
    return false;
  }

  // Test Case 1: Valid call
  console.log("Test 1: Valid call action");
  try {
    const input1 = {
      bet_amount: "200",
      player_stack: "1000",
      min_bet: "100",
      current_bet: "200",
      action_type: "2", // call
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input1,
      wasmPath,
      zkeyPath
    );

    console.log("✅ Proof generated");
    console.log("Valid:", publicSignals[0], "(1=valid, 0=invalid)");
    console.log(publicSignals[0] === "1" ? "✅ PASSED" : "❌ FAILED");
  } catch (error) {
    console.error("❌ Test 1 failed:", error.message);
    return false;
  }

  // Test 2: Valid raise (2x current bet)
  console.log("\nTest 2: Valid raise action");
  try {
    const input2 = {
      bet_amount: "400",
      player_stack: "1000",
      min_bet: "100",
      current_bet: "200",
      action_type: "4", // raise
    };

    const { publicSignals } = await snarkjs.groth16.fullProve(
      input2,
      wasmPath,
      zkeyPath
    );

    console.log("Valid:", publicSignals[0]);
    console.log(publicSignals[0] === "1" ? "✅ PASSED" : "❌ FAILED");
  } catch (error) {
    console.error("❌ Test 2 failed:", error.message);
    return false;
  }

  // Test Case 3: Invalid raise (less than 2x)
  console.log("\nTest 3: Invalid raise (less than 2x)");
  try {
    const input3 = {
      bet_amount: "300",
      player_stack: "1000",
      min_bet: "100",
      current_bet: "200",
      action_type: "4", // raise
    };

    const { publicSignals } = await snarkjs.groth16.fullProve(
      input3,
      wasmPath,
      zkeyPath
    );

    console.log("Valid:", publicSignals[0]);
    console.log(publicSignals[0] === "0" ? "✅ PASSED" : "❌ FAILED");
  } catch (error) {
    console.error("❌ Test 3 failed:", error.message);
    return false;
  }

  // Test Case 4: Fold (always valid)
  console.log("\nTest 4: Fold action (always valid)");
  try {
    const input4 = {
      bet_amount: "0",
      player_stack: "1000",
      min_bet: "100",
      current_bet: "200",
      action_type: "0", // fold
    };

    const { publicSignals } = await snarkjs.groth16.fullProve(
      input4,
      wasmPath,
      zkeyPath
    );

    console.log("Valid:", publicSignals[0]);
    console.log(publicSignals[0] === "1" ? "✅ PASSED" : "❌ FAILED");
  } catch (error) {
    console.error("❌ Test 4 failed:", error.message);
    return false;
  }

  // Test Case 5: All-in
  console.log("\nTest 5: All-in action");
  try {
    const input5 = {
      bet_amount: "1000",
      player_stack: "1000",
      min_bet: "100",
      current_bet: "200",
      action_type: "5", // all-in
    };

    const { publicSignals } = await snarkjs.groth16.fullProve(
      input5,
      wasmPath,
      zkeyPath
    );

    console.log("Valid:", publicSignals[0]);
    console.log(publicSignals[0] === "1" ? "✅ PASSED" : "❌ FAILED");
  } catch (error) {
    console.error("❌ Test 5 failed:", error.message);
    return false;
  }

  console.log("\n✅ All betting tests completed");
  return true;
}

// Run tests
testBetting()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
