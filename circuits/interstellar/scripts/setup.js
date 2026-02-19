#!/usr/bin/env node

/**
 * Setup script for ZK Interstellar circuits
 * Performs trusted setup ceremony for Groth16
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const CIRCUIT_NAME = 'shooting';
const BUILD_DIR = path.join(__dirname, '..', 'build');
const PTAU_FILE = 'powersOfTau28_hez_final_14.ptau';

async function runCommand(cmd, description) {
  console.log(`\n🔧 ${description}...`);
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Error: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.log(stderr);
      }
      console.log(stdout);
      resolve(stdout);
    });
  });
}

async function setup() {
  console.log('🚀 ZK Interstellar Circuit Setup\n');
  console.log('This will perform a trusted setup ceremony for the shooting game circuit.');
  console.log('This process may take several minutes...\n');

  try {
    // Check if build directory exists
    if (!fs.existsSync(BUILD_DIR)) {
      console.error('❌ Build directory not found. Please run "npm run compile:all" first.');
      process.exit(1);
    }

    // Check if circuit files exist
    const r1csPath = path.join(BUILD_DIR, `${CIRCUIT_NAME}.r1cs`);
    if (!fs.existsSync(r1csPath)) {
      console.error(`❌ Circuit file not found: ${r1csPath}`);
      console.error('Please run "npm run compile:shooting" first.');
      process.exit(1);
    }

    // Step 1: Download or use existing Powers of Tau
    if (!fs.existsSync(PTAU_FILE)) {
      console.log('📥 Downloading Powers of Tau file...');
      console.log('This is a one-time download from the Perpetual Powers of Tau ceremony.');
      
      await runCommand(
        `curl -L https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau -o ${PTAU_FILE}`,
        'Downloading Powers of Tau'
      );
    } else {
      console.log(`✅ Using existing Powers of Tau file: ${PTAU_FILE}`);
    }

    // Step 2: Generate proving and verification keys
    await runCommand(
      `snarkjs groth16 setup ${r1csPath} ${PTAU_FILE} ${CIRCUIT_NAME}_0000.zkey`,
      'Generating proving key'
    );

    await runCommand(
      `snarkjs zkey contribute ${CIRCUIT_NAME}_0000.zkey ${CIRCUIT_NAME}_final.zkey --name="Interstellar contribution" -e="$(date +%s)"`,
      'Contributing to circuit-specific setup'
    );

    // Step 3: Export verification key
    await runCommand(
      `snarkjs zkey export verificationkey ${CIRCUIT_NAME}_final.zkey verification_key.json`,
      'Exporting verification key'
    );

    // Step 4: Export Solidity verifier (for reference)
    await runCommand(
      `snarkjs zkey export solidityverifier ${CIRCUIT_NAME}_final.zkey verifier.sol`,
      'Exporting Solidity verifier (reference only)'
    );

    // Cleanup intermediate files
    fs.unlinkSync(`${CIRCUIT_NAME}_0000.zkey`);

    console.log('\n✅ Setup complete!');
    console.log('\nGenerated files:');
    console.log(`  - ${CIRCUIT_NAME}_final.zkey (proving key)`);
    console.log(`  - verification_key.json (verification key)`);
    console.log(`  - verifier.sol (Solidity verifier - reference)`);
    console.log('\n🎮 You can now generate proofs using "npm run generate-proof"');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setup();
