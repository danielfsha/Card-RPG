import { useCallback, useEffect } from "react";
import { StellarWalletsKit } from "@creit-tech/stellar-wallets-kit/sdk";
import { defaultModules } from "@creit-tech/stellar-wallets-kit/modules/utils";
import { KitEventType, Networks } from "@creit-tech/stellar-wallets-kit/types";
import {
  signAuthEntry as freighterSignAuthEntry,
  isConnected as isFreighterConnected,
} from "@stellar/freighter-api"; // Import Freighter API directly
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
          ensureKitInitialized(
            opts?.networkPassphrase || networkPassphrase || NETWORK_PASSPHRASE,
          );
          console.log("Requesting signature for auth entry...", {
            authEntry,
            networkPassphrase:
              opts?.networkPassphrase ||
              networkPassphrase ||
              NETWORK_PASSPHRASE,
            address: opts?.address || publicKey,
          });

          try {
            // Check for Freighter connection first to prioritize direct calls
            // This avoids SWK wrapping issues which often return empty signatures
            let hasFreighter = false;
            try {
              // Only check if we are in a browser environment
              if (typeof window !== "undefined") {
                const freighterStatus = await isFreighterConnected();
                hasFreighter = !!freighterStatus?.isConnected;
              }
            } catch (e) {
              console.log("Freighter detection check failed:", e);
            }

            let result: any = null;
            let signedAuthEntry: string | undefined = undefined;

            // STRATEGY 1: If Freighter is detected, try DIRECT execution first.
            // This bypasses the buggy SWK wrapper and prevents the need for a second popup.
            if (hasFreighter) {
              console.log(
                "Freighter detected. Attempting direct signing to avoid SWK issues.",
              );
              try {
                const directResult: any = await freighterSignAuthEntry(
                  authEntry,
                  {
                    networkPassphrase:
                      opts?.networkPassphrase ||
                      networkPassphrase ||
                      NETWORK_PASSPHRASE,
                    address: opts?.address || publicKey || undefined,
                  },
                );

                console.log(
                  "Direct Freighter Primary Result:",
                  JSON.stringify(directResult, null, 2),
                );

                if (typeof directResult === "string") {
                  signedAuthEntry = directResult;
                } else if (directResult?.signedAuthEntry) {
                  signedAuthEntry = directResult.signedAuthEntry;
                }
              } catch (err: any) {
                console.warn("Direct Freighter signing failed:", err);
                // If user explicitly rejected, rethrow to stop flow
                if (
                  err?.message?.includes("User declined") ||
                  err?.message?.includes("rejected") ||
                  (err?.error?.message &&
                    err.error.message.includes("User declined"))
                ) {
                  throw err;
                }
                // Otherwise fall through to SWK as backup
              }
            }

            // STRATEGY 2: If Direct failed or wasn't tried, use SWK
            if (!signedAuthEntry) {
              console.log("Using StellarWalletsKit for signing...");
              result = await StellarWalletsKit.signAuthEntry(authEntry, {
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

              signedAuthEntry =
                result?.signedAuthEntry ||
                (result as any)?.result ||
                (result as any)?.data ||
                (result as any)?.signedXdr ||
                (typeof result === "string" ? result : undefined);
            }

            // STRATEGY 3: Final Desperation Fallback (Confirm + Retry)
            if (!signedAuthEntry) {
              console.warn(
                "Both Direct and SWK methods returned no data. Triggering manual fallback flow.",
              );

              if (typeof window !== "undefined") {
                // Use confirm() as it is clearer than alert for actionable choices
                const shouldRetry = confirm(
                  "Connection Warning: The wallet returned no signature data.\n\nThis is likely due to a connection timeout.\n\nClick OK to force a direct connection to Freighter (Recommended).\nClick Cancel to abort.",
                );

                if (shouldRetry) {
                  const fallbackResult: any = await freighterSignAuthEntry(
                    authEntry,
                    {
                      networkPassphrase:
                        opts?.networkPassphrase ||
                        networkPassphrase ||
                        NETWORK_PASSPHRASE,
                      address: opts?.address || publicKey,
                    },
                  );
                  // Handle all fallback shapes
                  if (typeof fallbackResult === "string") {
                    signedAuthEntry = fallbackResult;
                  } else if (fallbackResult?.signedAuthEntry) {
                    signedAuthEntry = fallbackResult.signedAuthEntry;
                  }
                } else {
                  throw new Error("User cancelled fallback signature attempt.");
                }
              }
            }

            // Check signature presence one last time

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
                result && typeof result === "object"
                  ? result.signerAddress
                  : undefined,
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
