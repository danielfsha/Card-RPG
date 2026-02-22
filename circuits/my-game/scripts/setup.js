#!/usr/bin/env node

/**
 * Setup script for Card Battle Game ZK circuits
 * Compiles and performs trusted setup for a single circuit
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const circuitName = process.argv[2];

if (!circuitName) {
  console.error('❌ Please specify a circuit name');
  console.error('Usage: node scripts/setup.js <circuit_name>');
  console.error('Available circuits: win_condition, battle_calc, card_draw, card_summon, direct_attack, deck_shuffle');
  process.exit(1);
}

const BUILD_DIR = path.join(__dirname, '..', 'build');
const PTAU_FILE = path.join(__dirname, '..', 'powersOfTau28_hez_final_14.ptau');
const SRC_FILE = path.join(__dirname, '..', 'src', `${circuitName}.circom`);

console.log(`\n🔧 Setting up ${circuitName} circuit...\n`);

try {
  // Check if source file exists
  if (!fs.existsSync(SRC_FILE)) {
    console.error(`❌ Circuit source not found: ${SRC_FILE}`);
    process.exit(1);
  }

  // Check if Powers of Tau file exists
  if (!fs.existsSync(PTAU_FILE)) {
    console.error(`❌ Powers of Tau file not found: ${PTAU_FILE}`);
    console.error('Please download it from: https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau');
    process.exit(1);
  }

  // Create build directory if it doesn't exist
  if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
  }

  // Step 1: Compile circuit
  console.log('📝 Compiling circuit...');
  execSync(
    `circom ${SRC_FILE} --r1cs --wasm --sym -o ${BUILD_DIR}`,
    { stdio: 'inherit' }
  );

  const r1csPath = path.join(BUILD_DIR, `${circuitName}.r1cs`);
  
  // Step 2: Generate proving key
  console.log('\n🔑 Generating proving key...');
  execSync(
    `snarkjs groth16 setup ${r1csPath} ${PTAU_FILE} ${circuitName}_0000.zkey`,
    { stdio: 'inherit' }
  );

  // Step 3: Contribute to circuit-specific setup
  console.log('\n🎲 Contributing to setup...');
  execSync(
    `snarkjs zkey contribute ${circuitName}_0000.zkey ${circuitName}_final.zkey --name="Card game contribution" -v -e="${Date.now()}"`,
    { stdio: 'inherit' }
  );

  // Step 4: Export verification key
  console.log('\n📤 Exporting verification key...');
  execSync(
    `snarkjs zkey export verificationkey ${circuitName}_final.zkey ${circuitName}_verification_key.json`,
    { stdio: 'inherit' }
  );

  // Cleanup intermediate files
  if (fs.existsSync(`${circuitName}_0000.zkey`)) {
    fs.unlinkSync(`${circuitName}_0000.zkey`);
  }

  console.log(`\n✅ ${circuitName} setup complete!`);
  console.log('\nGenerated files:');
  console.log(`  - ${circuitName}_final.zkey`);
  console.log(`  - ${circuitName}_verification_key.json`);
  console.log(`  - build/${circuitName}.wasm`);

} catch (error) {
  console.error(`\n❌ Setup failed for ${circuitName}:`, error.message);
  process.exit(1);
}
