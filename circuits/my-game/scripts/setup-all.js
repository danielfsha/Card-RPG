const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const circuits = ['deck_shuffle', 'card_draw', 'card_summon', 'battle_calc', 'direct_attack', 'win_condition'];

console.log('🔧 Setting up all circuits for card battle game...\n');

circuits.forEach((circuit, index) => {
  console.log(`\n[${ index + 1}/${circuits.length}] Setting up ${circuit}...`);
  try {
    execSync(`node scripts/setup.js ${circuit}`, { stdio: 'inherit' });
    console.log(`✅ ${circuit} setup complete`);
  } catch (error) {
    console.error(`❌ Failed to setup ${circuit}:`, error.message);
    process.exit(1);
  }
});

console.log('\n🎉 All circuits setup complete!');
console.log('\nGenerated files:');
circuits.forEach(circuit => {
  console.log(`  - ${circuit}_final.zkey`);
  console.log(`  - ${circuit}_verification_key.json`);
});
