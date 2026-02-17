/**
 * Contract Signer interface for Stellar SDK bindings
 */
export interface WalletError {
  message: string;
  code: number;
}

export interface ContractSigner {
  signTransaction: (
    xdr: string,
    opts?: {
      networkPassphrase?: string;
      address?: string;
      submit?: boolean;
      submitUrl?: string;
    }
  ) => Promise<{
    signedTxXdr: string;
    signerAddress?: string;
    error?: WalletError;
  }>;

  signAuthEntry: (
    authEntry: string,
    opts?: {
      networkPassphrase?: string;
      address?: string;
    }
  ) => Promise<{
    signedAuthEntry: string;
    signerAddress?: string;
    error?: WalletError;
  }>;
}
