import { useCallback, useEffect } from "react";
import { StellarWalletsKit } from "@creit-tech/stellar-wallets-kit/sdk";
import { defaultModules } from "@creit-tech/stellar-wallets-kit/modules/utils";
import { KitEventType, Networks } from "@creit-tech/stellar-wallets-kit/types";
import { signAuthEntry as freighterSignAuthEntry } from "@stellar/freighter-api"; // Import Freighter API directly as backup
import { useWalletStore } from "../store/walletSlice";
import {
  devWalletService,
  DevWalletService,
} from "../services/devWalletService";
import { NETWORK, NETWORK_PASSPHRASE } from "../utils/constants";
import type { ContractSigner } from "../types/signer";

const KIT_WALLET_ID = "stellar-wallets-kit";
let kitInitialized = false;

function resolveNetwork(passphrase?: string): Networks {
  if (passphrase && Object.values(Networks).includes(passphrase as Networks)) {
    return passphrase as Networks;
  }
  return NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
}

function ensureKitInitialized(passphrase?: string) {
  if (typeof window === "undefined") return;

  if (!kitInitialized) {
    StellarWalletsKit.init({
      modules: defaultModules(),
      network: resolveNetwork(passphrase),
    });
    kitInitialized = true;
    return;
  }

  if (passphrase) {
    StellarWalletsKit.setNetwork(resolveNetwork(passphrase));
  }
}

export function useWallet() {
  const {
    publicKey,
    walletId,
    walletType,
    isConnected,
    isConnecting,
    network,
    networkPassphrase,
    error,
    setWallet,
    setConnecting,
    setNetwork,
    setError,
    disconnect: storeDisconnect,
  } = useWalletStore();

  /**
   * Connect with a real wallet (Freighter, etc.)
   */
  const connect = useCallback(async () => {
    try {
      setConnecting(true);
      setError(null);

      ensureKitInitialized(NETWORK_PASSPHRASE);
      const result = await StellarWalletsKit.authModal({});
      const address = typeof result === "string" ? result : result?.address;

      if (address) {
        setWallet(address, KIT_WALLET_ID, "wallet");
        setNetwork(NETWORK, NETWORK_PASSPHRASE);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to connect wallet";
      // User cancelled is a common "error" we might want to ignore or handle gracefully
      if (errorMessage !== "User cancelled") {
        setError(errorMessage);
        console.error("Wallet connection error:", err);
      }
    } finally {
      setConnecting(false);
    }
  }, [setWallet, setConnecting, setNetwork, setError]);

  /**
   * Connect as a dev player (for testing)
   * DEV MODE ONLY - Not used in production
   */
  const connectDev = useCallback(
    async (playerNumber: 1 | 2) => {
      try {
        setConnecting(true);
        setError(null);

        await devWalletService.initPlayer(playerNumber);
        const address = devWalletService.getPublicKey();

        // Update store with dev wallet
        setWallet(address, `dev-player${playerNumber}`, "dev");
        setNetwork(NETWORK, NETWORK_PASSPHRASE);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to connect dev wallet";
        setError(errorMessage);
        console.error("Dev wallet connection error:", err);
        throw err;
      } finally {
        setConnecting(false);
      }
    },
    [setWallet, setConnecting, setNetwork, setError],
  );

  /**
   * Switch between dev players
   * DEV MODE ONLY - Not used in production
   */
  const switchPlayer = useCallback(
    async (playerNumber: 1 | 2) => {
      if (walletType !== "dev") {
        throw new Error("Can only switch players in dev mode");
      }

      try {
        setConnecting(true);
        setError(null);

        await devWalletService.switchPlayer(playerNumber);
        const address = devWalletService.getPublicKey();

        // Update store with new player
        setWallet(address, `dev-player${playerNumber}`, "dev");
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to switch player";
        setError(errorMessage);
        console.error("Player switch error:", err);
        throw err;
      } finally {
        setConnecting(false);
      }
    },
    [walletType, setWallet, setConnecting, setError],
  );

  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(async () => {
    if (walletType === "dev") {
      devWalletService.disconnect();
    }
    storeDisconnect();
  }, [walletType, storeDisconnect]);

  /**
   * Get a signer for contract interactions
   * Returns functions that the Stellar SDK TS bindings can use for signing
   */
  const getContractSigner = useCallback((): ContractSigner => {
    if (!isConnected || !publicKey || !walletType) {
      throw new Error("Wallet not connected");
    }

    if (walletType === "dev") {
      // Dev wallet uses the dev wallet service's signer
      return devWalletService.getSigner();
    } else {
      // Real wallet signing via stellar-wallets-kit
      return {
        signTransaction: async (
          xdr: string,
          opts?: {
            networkPassphrase?: string;
            address?: string;
            submit?: boolean;
            submitUrl?: string;
          },
        ) => {
          try {
            ensureKitInitialized(
              opts?.networkPassphrase ||
                networkPassphrase ||
                NETWORK_PASSPHRASE,
            );
            const result = await StellarWalletsKit.signTransaction(xdr, {
              networkPassphrase:
                opts?.networkPassphrase ||
                networkPassphrase ||
                NETWORK_PASSPHRASE,
              address: opts?.address || publicKey || undefined,
              submit: opts?.submit,
              submitUrl: opts?.submitUrl,
            });

            // Handle potential undefined return from kit if error wasn't thrown
            if (!result.signedTxXdr) {
              throw new Error("No signed XDR returned from wallet");
            }

            return {
              signedTxXdr: result.signedTxXdr,
              signerAddress: result.signerAddress,
            };
          } catch (e) {
            console.error("Sign transaction error:", e);
            // Return error object as expected by ContractSigner interface
            return {
              signedTxXdr: xdr, // Return original on failure? Or empty? usually original + error
              error: {
                message:
                  e instanceof Error
                    ? e.message
                    : "Checking wallet signature failed",
                code: -1, // Generic error code
              },
            };
          }
        },
        signAuthEntry: async (
          authEntry: string,
          opts?: { networkPassphrase?: string; address?: string },
        ) => {
          try {
            ensureKitInitialized(
              opts?.networkPassphrase ||
                networkPassphrase ||
                NETWORK_PASSPHRASE,
            );
            console.log("Requesting signature for auth entry...", {
              authEntry,
              networkPassphrase:
                opts?.networkPassphrase ||
                networkPassphrase ||
                NETWORK_PASSPHRASE,
              address: opts?.address || publicKey,
            });

            const result = await StellarWalletsKit.signAuthEntry(authEntry, {
              networkPassphrase:
                opts?.networkPassphrase ||
                networkPassphrase ||
                NETWORK_PASSPHRASE,
              address: opts?.address || publicKey || undefined,
            });

            console.log(
              "Wallet signAuthEntry result:",
              JSON.stringify(result, null, 2),
            );

            // Freighter sometimes returns the signed auth entry directly as a string in some versions/configurations
            // or inside the result object. Let's try to handle both.
            // Also check for 'result' property or other common variations
            let signedAuthEntry: string | undefined =
              result?.signedAuthEntry ||
              (result as any)?.result ||
              (result as any)?.data ||
              (result as any)?.signedXdr || // Some older versions use this for txs, checking just in case
              (typeof result === "string" ? result : undefined);

            // If SWK fails or returns nothing, try calling Freighter API directly as a fallback
            if (!signedAuthEntry) {
              console.log(
                "SWK returned no signed auth entry. Attempting direct Freighter fallback...",
              );
              try {
                // Try to use the imported freighter API directly if available
                // Note: This assumes the user is using Freighter, which is the most common cause of this error
                const directResult: any = await freighterSignAuthEntry(
                  authEntry,
                  {
                    networkPassphrase:
                      opts?.networkPassphrase ||
                      networkPassphrase ||
                      NETWORK_PASSPHRASE,
                    address: opts?.address || publicKey,
                  },
                );
                console.log(
                  "Direct Freighter result:",
                  JSON.stringify(directResult, null, 2),
                );

                // Inspect all properties of directResult to find the signature
                if (directResult) {
                  if (typeof directResult === "string") {
                    signedAuthEntry = directResult;
                  } else if (directResult.signedAuthEntry) {
                    signedAuthEntry = directResult.signedAuthEntry;
                  } else if (
                    directResult.address &&
                    directResult.address.length > 0
                  ) {
                    // Sometimes it might just return the address if it failed? Unlikely.
                  } else {
                    // Try to find any string property that looks like a signature (base64)
                    // This is a desperation move but helpful for debugging
                    const keys = Object.keys(directResult);
                    for (const key of keys) {
                      const val = directResult[key];
                      if (
                        (typeof val === "string" &&
                          val.length > 20 &&
                          key.toLowerCase().includes("xdr")) ||
                        key.toLowerCase().includes("entry") ||
                        key.toLowerCase().includes("signed")
                      ) {
                        console.log(
                          `Found potential signature in key '${key}': ${val.substring(0, 10)}...`,
                        );
                        signedAuthEntry = val;
                        break;
                      }
                    }
                  }
                }
              } catch (fallbackErr) {
                console.error(
                  "Direct Freighter fallback failed or user declined:",
                  fallbackErr,
                );
              }
            }

            // Important: Freighter 2.0+ might return just the signed XDR string directly in some cases
            // or we might missed extracting it correctly.
            // Let's verify what we have before giving up.

            // If we found something, verify it looks like a base64 string
            if (
              signedAuthEntry &&
              (typeof signedAuthEntry !== "string" ||
                signedAuthEntry.length < 10)
            ) {
              // Not a valid auth entry string
              console.warn(
                "Invalid signedAuthEntry format detected:",
                signedAuthEntry,
              );
              signedAuthEntry = undefined;
            }

            console.log(
              "Extracted signedAuthEntry:",
              signedAuthEntry
                ? "Yes (length " + signedAuthEntry.length + ")"
                : "No",
            );

            if (!signedAuthEntry) {
              // If the wallet explicitly returns validation errors or "rejected"
              const msg =
                "No signed auth entry returned. Please ensure you are on Testnet and approve the transaction.";
              throw new Error(msg);
            }

            return {
              signedAuthEntry: signedAuthEntry,
              signerAddress:
                typeof result === "object" ? result.signerAddress : undefined,
            };
          } catch (e: any) {
            console.error("Sign auth entry error:", e);

            // If we deliberately threw the "No signed auth..." error above, keep it
            const errorMessage = e instanceof Error ? e.message : String(e);

            // Only classify as "cancelled" if the WALLET actually said so
            if (
              (errorMessage.includes("User declined") ||
                errorMessage.includes("cancel") ||
                errorMessage.includes("rejected")) &&
              !errorMessage.includes("No signed auth entry returned") // Don't mask our own error
            ) {
              return {
                signedAuthEntry: authEntry,
                error: {
                  message: "Signing cancelled by user",
                  code: -2,
                },
              };
            }

            return {
              signedAuthEntry: authEntry,
              error: {
                message: errorMessage,
                code: -1,
              },
            };
          }
        },
      };
    }
  }, [isConnected, publicKey, walletType, networkPassphrase]);

  // Listen for wallet changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only initialize if we're not using dev wallet
    if (walletType !== "dev") {
      ensureKitInitialized(NETWORK_PASSPHRASE);
    }

    // Check for existing connection if not already connected
    const checkConnection = async () => {
      // Only check if we are not connected OR if we are supposed to be connected to a real wallet
      // but maybe strict check isn't needed if getAddress() returns null when not connected
      if (
        !isConnected &&
        !isConnecting &&
        (walletType === null || walletType === "wallet")
      ) {
        try {
          const address = (await StellarWalletsKit.getAddress()).address;
          if (address) {
            setWallet(address, KIT_WALLET_ID, "wallet");
            setNetwork(NETWORK, NETWORK_PASSPHRASE);
          }
        } catch (e) {
          // Ignore errors here
        }
      }
    };

    checkConnection();
  }, [isConnected, isConnecting, walletType, setWallet, setNetwork]);

  /**
   * Check if dev mode is available
   */
  const isDevModeAvailable = useCallback(() => {
    return DevWalletService.isDevModeAvailable();
  }, []);

  /**
   * Check if a specific dev player is available
   */
  const isDevPlayerAvailable = useCallback((playerNumber: 1 | 2) => {
    return DevWalletService.isPlayerAvailable(playerNumber);
  }, []);

  /**
   * Get current dev player number
   */
  const getCurrentDevPlayer = useCallback(() => {
    if (walletType !== "dev") {
      return null;
    }
    return devWalletService.getCurrentPlayer();
  }, [walletType]);

  return {
    // State
    publicKey,
    walletId,
    walletType,
    isConnected,
    isConnecting,
    network,
    networkPassphrase,
    error,

    // Actions
    connect,
    connectDev,
    switchPlayer,
    disconnect,
    getContractSigner,
    isDevModeAvailable,
    isDevPlayerAvailable,
    getCurrentDevPlayer,
  };
}
