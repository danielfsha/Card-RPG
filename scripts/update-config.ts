#!/usr/bin/env bun
/**
 * Update game-studio-config.js from .env file
 * Usage: bun run scripts/update-config.ts <game-name>
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const gameName = process.argv[2];
if (!gameName) {
  console.error('❌ Error: Game name required');
  console.log('Usage: bun run scripts/update-config.ts <game-name>');
  process.exit(1);
}

const repoRoot = path.resolve(import.meta.dir, '..');
const envPath = path.join(repoRoot, '.env');
const configPath = path.join(repoRoot, gameName, 'public', 'game-studio-config.js');

// Check if .env exists
if (!existsSync(envPath)) {
  console.error(`❌ Error: .env file not found at ${envPath}`);
  process.exit(1);
}

// Read .env file
function readEnvFile(filePath: string): Record<string, string> {
  const content = readFileSync(filePath, 'utf-8');
  const env: Record<string, string> = {};
  
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  }
  
  return env;
}

const env = readEnvFile(envPath);

// Convert game-name to env key format (e.g., "pocker" -> "POCKER")
const envKey = gameName.replace(/-/g, '_').toUpperCase();
const contractIdKey = `VITE_${envKey}_CONTRACT_ID`;

const rpcUrl = env.VITE_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const networkPassphrase = env.VITE_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
const contractId = env[contractIdKey] || '';

if (!contractId) {
  console.warn(`⚠️  Warning: ${contractIdKey} not found in .env`);
}

const runtimeConfig = {
  rpcUrl,
  networkPassphrase,
  contractIds: {
    [gameName]: contractId,
  },
  simulationSourceAddress: env.VITE_SIMULATION_SOURCE_ADDRESS || '',
  configVersion: new Date().toISOString(),
};

const configText = `window.__STELLAR_GAME_STUDIO_CONFIG__ = ${JSON.stringify(runtimeConfig, null, 2)};\n`;

// Write config file
try {
  writeFileSync(configPath, configText);
  console.log(`✅ Updated ${configPath}`);
  console.log(`   Contract ID: ${contractId || '(not set)'}`);
  console.log(`   RPC URL: ${rpcUrl}`);
  console.log(`   Network: ${networkPassphrase}`);
} catch (err) {
  console.error(`❌ Error writing config file: ${err}`);
  process.exit(1);
}
