#!/usr/bin/env node

/**
 * Setup script for all ZK Interstellar circuits
 * Performs trusted setup ceremony for Groth16 on all 4 circuits
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const CIRCUITS = ['shooting', 'damage', 'item_collection', 'win_condition'];
const BUILD_DIR = path.join(__dirname, '..', 'build');
const PTAU_FILE = 'powersOfTau28_hez_final_14.ptau';

async function runCommand(cmd, description) {
  console.log(`\n🔧 ${description}...`);
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
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

async function setupCircuit(circuitName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎯 Setting up ${circuitName} circuit`);
  console.log('='.repeat(60));

  const r1csPath = path.join(BUILD_DIR, `${circuitName}.r1cs`);
  
  if (!fs.existsSync(r1csPath)) {
    console.error(`❌ Circuit file not found: ${r1csPath}`);
    throw new Error(`Missing ${circuitName}.r1cs`);
  }

  // Generate proving and verification keys
  await runCommand(
    `snarkjs groth16 setup ${r1csPath} ${PTAU_FILE} ${circuitName}_0000.zkey`,
    `Generating proving key for ${circuitName}`
  );

  await runCommand(
    `snarkjs zkey contribute ${circuitName}_0000.zkey ${circuitName}_final.zkey --name="Interstellar ${circuitName}" -e="$(date +%s)"`,
    `Contributing to ${circuitName} setup`
  );

  // Export verification key
  await runCommand(
    `snarkjs zkey export verificationkey ${circuitName}_final.zkey ${circuitName}_verification_key.json`,
    `Exporting verification key for ${circuitName}`
  );

  // Cleanup intermediate files
  fs.unlinkSync(`${circuitName}_0000.zkey`);

  console.log(`✅ ${circuitName} setup complete!`);
}

async function setup() {
  console.log('🚀 ZK Interstellar Circuits - Full Setup\n');
  console.log('This will perform trusted setup for all 4 game circuits:');
  CIRCUITS.forEach(c => console.log(`  - ${c}`));
  console.log('\nThis process may take 10-15 minutes...\n');

  try {
    // Check if build directory exists
    if (!fs.existsSync(BUILD_DIR)) {
      console.error('❌ Build directory not found. Please compile circuits first.');
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

    // Step 2: Setup each circuit
    for (const circuit of CIRCUITS) {
      await setupCircuit(circuit);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL CIRCUITS SETUP COMPLETE!');
    console.log('='.repeat(60));
    console.log('\nGenerated files:');
    CIRCUITS.forEach(c => {
      console.log(`  ${c}:`);
      console.log(`    - ${c}_final.zkey (proving key)`);
      console.log(`    - ${c}_verification_key.json (verification key)`);
    });
    console.log('\n🎮 Ready to generate proofs and deploy to Stellar!');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setup();
