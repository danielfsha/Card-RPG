#!/usr/bin/env node

/**
 * Generate ZK proof for Interstellar shooter game
 * Example script showing how to generate shooting proofs
 */

const snarkjs = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');
const fs = require('fs');
const path = require('path');

// Example game scenarios
const EXAMPLE_SCENARIOS = {
  directHit: {
    shooter_x: 100,
    shooter_y: 50,
    shooter_z: 0,
    target_x: 150,
    target_y: 50,
    target_z: 0,
    shot_direction_x: 1000, // Normalized direction * 1000
    shot_direction_y: 0,
    shot_direction_z: 0,
    distance: 50,
    max_range: 100
  },
  miss: {
    shooter_x: 100,
    shooter_y: 50,
    shooter_z: 0,
    target_x: 150,
    target_y: 100,
    target_z: 0,
    shot_direction_x: 1000,
    shot_direction_y: 0,
    shot_direction_z: 0,
    distance: 70,
    max_range: 100
  }
};

async function generateCommitment(position, salt) {
  const poseidon = await buildPoseidon();
  const inputs = [BigInt(position.x), BigInt(position.y), BigInt(position.z), BigInt(salt)];
  const hash = poseidon(inputs);
  return poseidon.F.toString(hash);
}

function randomSalt() {
  return BigInt('0x' + Array.from({ length: 64 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join(''));
}

async function generateShootingProof(scenario) {
  console.log('🚀 Generating ZK Interstellar Shooting Proof\n');

  const {
    shooter_x, shooter_y, shooter_z,
    target_x, target_y, target_z,
    shot_direction_x, shot_direction_y, shot_direction_z,
    distance, max_range
  } = scenario;

  console.log('Shooter Position:', { x: shooter_x, y: shooter_y, z: shooter_z });
  console.log('Target Position:', { x: target_x, y: target_y, z: target_z });
  console.log('Shot Direction:', { x: shot_direction_x, y: shot_direction_y, z: shot_direction_z });
  console.log('Distance:', distance);
  console.log('Max Range:', max_range);
  console.log('');

  // Generate random salts for position commitments
  const shooterSalt = randomSalt();
  const targetSalt = randomSalt();

  // Generate commitments
  console.log('📝 Generating position commitments...');
  const shooterCommitment = await generateCommitment(
    { x: shooter_x, y: shooter_y, z: shooter_z },
    shooterSalt
  );
  const targetCommitment = await generateCommitment(
    { x: target_x, y: target_y, z: target_z },
    targetSalt
  );

  console.log('Shooter Commitment:', shooterCommitment);
  console.log('Target Commitment:', targetCommitment);
  console.log('');

  // Prepare circuit inputs
  const input = {
    shooter_x: String(shooter_x),
    shooter_y: String(shooter_y),
    shooter_z: String(shooter_z),
    target_x: String(target_x),
    target_y: String(target_y),
    target_z: String(target_z),
    shot_direction_x: String(shot_direction_x),
    shot_direction_y: String(shot_direction_y),
    shot_direction_z: String(shot_direction_z),
    distance: String(distance),
    max_range: String(max_range),
    shooter_salt: shooterSalt.toString(),
    target_salt: targetSalt.toString(),
    shooter_commitment: shooterCommitment,
    target_commitment: targetCommitment
  };

  // Generate proof
  console.log('🔐 Generating zero-knowledge proof...');
  console.log('(This may take a few seconds)');

  const wasmPath = path.join(__dirname, '..', 'build', 'shooting_js', 'shooting.wasm');
  const zkeyPath = path.join(__dirname, '..', 'shooting_final.zkey');

  if (!fs.existsSync(wasmPath)) {
    console.error('❌ WASM file not found. Please run "npm run compile:shooting" first.');
    process.exit(1);
  }

  if (!fs.existsSync(zkeyPath)) {
    console.error('❌ Proving key not found. Please run "npm run setup" first.');
    process.exit(1);
  }

  const startTime = Date.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath
  );
  const proofTime = Date.now() - startTime;

  console.log(`✅ Proof generated in ${proofTime}ms\n`);

  // Verify proof
  console.log('🔍 Verifying proof...');
  const vkeyPath = path.join(__dirname, '..', 'verification_key.json');
  const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));

  const verifyStartTime = Date.now();
  const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  const verifyTime = Date.now() - verifyStartTime;

  if (isValid) {
    console.log(`✅ Proof verified in ${verifyTime}ms\n`);
  } else {
    console.log('❌ Invalid proof!\n');
    process.exit(1);
  }

  // Parse public signals
  console.log('📊 Shot Results:');
  console.log('Shooter Commitment:', publicSignals[0]);
  console.log('Target Commitment:', publicSignals[1]);
  const hit = parseInt(publicSignals[2]);
  console.log('Hit:', hit === 1 ? '✅ HIT!' : '❌ MISS');
  console.log('');

  // Save proof to file
  const proofData = {
    proof,
    publicSignals,
    input: {
      shooter_position: { x: shooter_x, y: shooter_y, z: shooter_z },
      target_position: { x: target_x, y: target_y, z: target_z },
      shot_direction: { x: shot_direction_x, y: shot_direction_y, z: shot_direction_z },
      distance,
      max_range,
      shooterCommitment,
      targetCommitment
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      proofTime: `${proofTime}ms`,
      verifyTime: `${verifyTime}ms`,
      result: hit === 1 ? 'HIT' : 'MISS'
    }
  };

  const outputPath = path.join(__dirname, '..', 'proof.json');
  fs.writeFileSync(outputPath, JSON.stringify(proofData, null, 2));
  console.log(`💾 Proof saved to: ${outputPath}`);

  return proofData;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  let scenario;

  if (args.length === 0) {
    // Use example scenario
    console.log('Using example scenario (Direct Hit)\n');
    scenario = EXAMPLE_SCENARIOS.directHit;
  } else if (args[0] === 'miss') {
    console.log('Using example scenario (Miss)\n');
    scenario = EXAMPLE_SCENARIOS.miss;
  } else {
    console.log('Usage: node generate_proof.js [miss]');
    console.log('\nRunning with default direct hit scenario...\n');
    scenario = EXAMPLE_SCENARIOS.directHit;
  }

  try {
    await generateShootingProof(scenario);
    console.log('\n🎉 Success!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
