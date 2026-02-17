export const SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';
export const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
export const NETWORK = SOROBAN_RPC_URL.includes('testnet') ? 'testnet' : 'mainnet';

// Contract addresses
export const POCKER_CONTRACT = import.meta.env.VITE_POCKER_CONTRACT_ID || 'CADFQXKSMYG5VR2JIXGT7WMUDDOXEUC7HXLWOHH2Z7HOVUVBZ6YA4WLS';

// RPC and network config
export const RPC_URL = SOROBAN_RPC_URL;

// Transaction options
export const DEFAULT_METHOD_OPTIONS = {
  timeoutInSeconds: 30,
};

export const DEFAULT_AUTH_TTL_MINUTES = 5;
export const MULTI_SIG_AUTH_TTL_MINUTES = 60;
