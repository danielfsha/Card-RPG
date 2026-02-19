// Type definitions for Freighter wallet
interface FreighterAPI {
  isConnected: () => Promise<boolean>;
  isAllowed: () => Promise<{ isAllowed: boolean }>;
  setAllowed: () => Promise<void>;
  getPublicKey: () => Promise<string>;
  getNetwork: () => Promise<string>;
  signTransaction: (xdr: string, opts?: { network?: string; networkPassphrase?: string }) => Promise<string>;
  signAuthEntry: (entryXdr: string, opts?: { networkPassphrase?: string }) => Promise<string>;
}

interface Window {
  freighter?: FreighterAPI;
}
