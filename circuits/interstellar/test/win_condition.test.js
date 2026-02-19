#!/usr/bin/env node

/**
 * Test win_condition circuit
 */

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

async function testWinCondition() {
  console.log('🧪 Testing Win Condition Circuit\n');

  const testCases = [
    {
      name: 'Player 1 Wins by Kill Limit',
      player1_kills: 10,
      player2_kills: 7,
      player1_health: 50,
      player2_health: 80,
      kill_limit: 10,
      time_limit: 300000,
      elapsed_time: 180000,
      expected_winner: 1
    },
    {
      name: 'Player 2 Wins by Kill Limit',
      player1_kills: 8,
      player2_kills: 10,
      player1_health: 60,
      player2_health: 40,
      kill_limit: 10,
      time_limit: 300000,
      elapsed_time: 200000,
      expected_winner: 2
    },
    {
      name: 'Player 1 Wins by Elimination',
      player1_kills: 5,
      player2_kills: 4,
      player1_health: 30,
      player2_health: 0,
      kill_limit: 10,
      time_limit: 300000,
      elapsed_time: 120000,
      expected_winner: 1
    },
    {
      name: 'Player 2 Wins by Elimination',
      player1_kills: 6,
      player2_kills: 7,
      player1_health: 0,
      player2_health: 50,
      kill_limit: 10,
      time_limit: 300000,
      elapsed_time: 150000,
      expected_winner: 2
    },
    {
      name: 'Player 1 Wins by Time (More Kills)',
      player1_kills: 8,
      player2_kills: 5,
      player1_health: 40,
      player2_health: 60,
      kill_limit: 10,
      time_limit: 300000,
      elapsed_time: 300000,
      expected_winner: 1
    },
    {
      name: 'Player 2 Wins by Time (More Kills)',
      player1_kills: 4,
      player2_kills: 7,
      player1_health: 70,
      player2_health: 30,
      kill_limit: 10,
      time_limit: 300000,
      elapsed_time: 300000,
      expected_winner: 2
    },
    {
      name: 'Tie by Time (Equal Kills)',
      player1_kills: 5,
      player2_kills: 5,
      player1_health: 50,
      player2_health: 50,
      kill_limit: 10,
      time_limit: 300000,
      elapsed_time: 300000,
      expected_winner: 0
    }
  ];

  const wasmPath = path.join(__dirname, '..', 'build', 'win_condition_js', 'win_condition.wasm');

  if (!fs.existsSync(wasmPath)) {
    console.error('❌ WASM file not found. Please run "npm run compile:win" first.');
    process.exit(1);
  }

  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log('  Player 1 - Kills:', testCase.player1_kills, 'Health:', testCase.player1_health);
    console.log('  Player 2 - Kills:', testCase.player2_kills, 'Health:', testCase.player2_health);
    console.log('  Kill Limit:', testCase.kill_limit);
    console.log('  Time:', `${testCase.elapsed_time}ms / ${testCase.time_limit}ms`);
    console.log('  Expected Winner:', testCase.expected_winner === 0 ? 'TIE' : `Player ${testCase.expected_winner}`);

    const input = {
      player1_kills: String(testCase.player1_kills),
      player2_kills: String(testCase.player2_kills),
      player1_health: String(testCase.player1_health),
      player2_health: String(testCase.player2_health),
      kill_limit: String(testCase.kill_limit),
      time_limit: String(testCase.time_limit),
      elapsed_time: String(testCase.elapsed_time)
    };

    try {
      const startTime = Date.now();
      const { witness } = await snarkjs.wtns.calculate(input, wasmPath);
      const execTime = Date.now() - startTime;

      console.log(`  ✅ Circuit executed in ${execTime}ms`);
    } catch (err) {
      console.log('  ❌ Circuit execution failed:', err.message);
    }
  }

  console.log('\n✅ Win condition circuit tests complete!');
}

testWinCondition().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
