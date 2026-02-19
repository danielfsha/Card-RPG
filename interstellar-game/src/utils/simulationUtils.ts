import { StrKey } from '@stellar/stellar-sdk';
import { NETWORK } from './constants';

// Dev addresses from .env
const DEV_ADMIN_ADDRESS = import.meta.env.VITE_DEV_ADMIN_ADDRESS || '';
const DEV_PLAYER1_ADDRESS = import.meta.env.VITE_DEV_PLAYER1_ADDRESS || '';
const DEV_PLAYER2_ADDRESS = import.meta.env.VITE_DEV_PLAYER2_ADDRESS || '';
const RUNTIME_SIMULATION_SOURCE = import.meta.env.VITE_SIMULATION_SOURCE || '';

async function horizonAccountExists(address: string): Promise<boolean> {
  const horizonUrl =
    NETWORK === 'testnet'
      ? 'https://horizon-testnet.stellar.org'
      : NETWORK === 'mainnet'
      ? 'https://horizon.stellar.org'
      : null;

  if (!horizonUrl) return true;

  try {
    const res = await fetch(`${horizonUrl}/accounts/${address}`, { method: 'GET' });
    if (res.status === 404) return false;
    if (!res.ok) throw new Error(`Horizon error ${res.status} checking account existence`);
    return true;
  } catch (err) {
    console.warn('[horizonAccountExists] Error checking account:', err);
    return false;
  }
}

async function ensureTestnetAccountFunded(address: string): Promise<void> {
  if (NETWORK !== 'testnet') return;
  if (await horizonAccountExists(address)) return;

  console.log('[ensureTestnetAccountFunded] Funding account via Friendbot:', address);

  try {
    const fundRes = await fetch(`https://friendbot.stellar.org?addr=${address}`, { method: 'GET' });
    if (!fundRes.ok) {
      throw new Error(`Friendbot funding failed (${fundRes.status}) for ${address}`);
    }

    // Give Horizon a moment to index
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((r) => setTimeout(r, 750));
      if (await horizonAccountExists(address)) return;
    }

    throw new Error(`Funded ${address} but it still doesn't appear on Horizon yet`);
  } catch (err) {
    console.error('[ensureTestnetAccountFunded] Error funding account:', err);
    throw err;
  }
}

export async function getSimulationSourceAddress(avoidAddresses: string[] = []): Promise<string> {
  const avoid = new Set(avoidAddresses.filter(Boolean));
  const candidates = [
    RUNTIME_SIMULATION_SOURCE,
    DEV_ADMIN_ADDRESS,
    DEV_PLAYER2_ADDRESS,
    DEV_PLAYER1_ADDRESS,
  ].filter(Boolean);

  console.log('[getSimulationSourceAddress] Candidates:', candidates);
  console.log('[getSimulationSourceAddress] Avoiding:', Array.from(avoid));

  for (const candidate of candidates) {
    if (avoid.has(candidate)) {
      console.log('[getSimulationSourceAddress] Skipping (in avoid list):', candidate);
      continue;
    }
    if (StrKey.isValidEd25519PublicKey(candidate)) {
      console.log('[getSimulationSourceAddress] Selected:', candidate);
      return candidate;
    }
  }

  throw new Error(
    'No valid on-chain account available to build/simulate this transaction. Run `bun run setup` to populate `VITE_DEV_*_ADDRESS`, or fund your connected wallet account.'
  );
}

export async function getFundedSimulationSourceAddress(avoidAddresses: string[] = []): Promise<string> {
  const addr = await getSimulationSourceAddress(avoidAddresses);
  await ensureTestnetAccountFunded(addr);
  return addr;
}
