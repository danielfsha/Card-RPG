import { Client as PockerClient, type Game } from "./bindings";
import {
  NETWORK_PASSPHRASE,
  RPC_URL,
  DEFAULT_METHOD_OPTIONS,
  DEFAULT_AUTH_TTL_MINUTES,
  MULTI_SIG_AUTH_TTL_MINUTES,
} from "@/utils/constants";
import {
  contract,
  TransactionBuilder,
  StrKey,
  xdr,
  Address,
  authorizeEntry,
} from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import { signAndSendViaLaunchtube } from "@/utils/transactionHelper";
import { calculateValidUntilLedger } from "@/utils/ledgerUtils";
import { injectSignedAuthEntry } from "@/utils/authEntryUtils";

type ClientOptions = contract.ClientOptions;

/**
 * Service for interacting with the ZK Poker game contract
 */
export class PockerService {
  private baseClient: PockerClient;
  private contractId: string;

  constructor(contractId: string) {
    this.contractId = contractId;
    // Base client for read-only operations
    this.baseClient = new PockerClient({
      contractId: this.contractId,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: RPC_URL,
    });
  }

  /**
   * Create a client with signing capabilities
   */
  private createSigningClient(
    publicKey: string,
    signer: Pick<contract.ClientOptions, "signTransaction" | "signAuthEntry">,
  ): PockerClient {
    const options: ClientOptions = {
      contractId: this.contractId,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: RPC_URL,
      publicKey,
      ...signer,
    };
    return new PockerClient(options);
  }

  /**
   * Get game state
   * Returns null if game doesn't exist (instead of throwing)
   */
  async getGame(sessionId: number): Promise<Game | null> {
    try {
      const tx = await this.baseClient.get_game({ session_id: sessionId });
      const result = await tx.simulate();

      // Check if result is Ok before unwrapping
      if (result.result.isOk()) {
        return result.result.unwrap();
      } else {
        // Game doesn't exist or contract returned error
        console.log("[getGame] Game not found for session:", sessionId);
        return null;
      }
    } catch (err) {
      // Simulation or contract call failed
      console.log("[getGame] Error querying game:", err);
      return null;
    }
  }

  /**
   * Start a new game (requires multi-sig authorization)
   * Note: This requires both players to sign the transaction
   */
  async startGame(
    sessionId: number,
    player1: string,
    player2: string,
    player1Points: bigint,
    player2Points: bigint,
    signer: Pick<contract.ClientOptions, "signTransaction" | "signAuthEntry">,
    authTtlMinutes?: number,
  ) {
    const client = this.createSigningClient(player1, signer);
    const tx = await client.start_game(
      {
        session_id: sessionId,
        player1,
        player2,
        player1_points: player1Points,
        player2_points: player2Points,
      },
      DEFAULT_METHOD_OPTIONS,
    );

    const validUntilLedgerSeq = authTtlMinutes
      ? await calculateValidUntilLedger(RPC_URL, authTtlMinutes)
      : await calculateValidUntilLedger(RPC_URL, DEFAULT_AUTH_TTL_MINUTES);

    const sentTx = await signAndSendViaLaunchtube(
      tx,
      DEFAULT_METHOD_OPTIONS.timeoutInSeconds,
      validUntilLedgerSeq,
    );
    return sentTx;
  }

  /**
   * STEP 1 (Player 1): Prepare a start game transaction and export signed auth entry
   */
  async prepareStartGame(
    sessionId: number,
    player1: string,
    player2: string,
    player1Points: bigint,
    player2Points: bigint,
    player1Signer: Pick<
      contract.ClientOptions,
      "signTransaction" | "signAuthEntry"
    >,
    authTtlMinutes?: number,
  ): Promise<string> {
    // Build transaction with Player 2 as the source
    const buildClient = new PockerClient({
      contractId: this.contractId,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: RPC_URL,
      publicKey: player2,
    });

    const tx = await buildClient.start_game(
      {
        session_id: sessionId,
        player1,
        player2,
        player1_points: player1Points,
        player2_points: player2Points,
      },
      DEFAULT_METHOD_OPTIONS,
    );

    console.log("[prepareStartGame] Transaction built and simulated");

    if (!tx.simulationData?.result?.auth) {
      throw new Error("No auth entries found in simulation");
    }

    const authEntries = tx.simulationData.result.auth;
    console.log("[prepareStartGame] Found", authEntries.length, "auth entries");

    // Find Player 1's auth entry
    let player1AuthEntry = null;

    for (let i = 0; i < authEntries.length; i++) {
      const entry = authEntries[i];
      try {
        const entryAddress = entry.credentials().address().address();
        const entryAddressString =
          Address.fromScAddress(entryAddress).toString();

        if (entryAddressString === player1) {
          player1AuthEntry = entry;
          console.log(`[prepareStartGame] Found Player 1 auth entry at index ${i}`);
          break;
        }
      } catch (err) {
        continue;
      }
    }

    if (!player1AuthEntry) {
      throw new Error(`No auth entry found for Player 1 (${player1})`);
    }

    const validUntilLedgerSeq = authTtlMinutes
      ? await calculateValidUntilLedger(RPC_URL, authTtlMinutes)
      : await calculateValidUntilLedger(RPC_URL, MULTI_SIG_AUTH_TTL_MINUTES);

    if (!player1Signer.signAuthEntry) {
      throw new Error("signAuthEntry function not available");
    }

    const signedAuthEntry = await authorizeEntry(
      player1AuthEntry,
      async (preimage) => {
        console.log("[prepareStartGame] Signing preimage with wallet...");

        if (!player1Signer.signAuthEntry) {
          throw new Error("Wallet does not support auth entry signing");
        }

        const signResult = await player1Signer.signAuthEntry(
          preimage.toXDR("base64"),
          {
            networkPassphrase: NETWORK_PASSPHRASE,
            address: player1,
          },
        );

        if (signResult.error) {
          throw new Error(`Failed to sign auth entry: ${signResult.error.message}`);
        }

        return Buffer.from(signResult.signedAuthEntry, "base64");
      },
      validUntilLedgerSeq,
      NETWORK_PASSPHRASE,
    );

    const signedAuthEntryXdr = signedAuthEntry.toXDR("base64");
    console.log("[prepareStartGame] ✅ Successfully signed Player 1 auth entry");
    return signedAuthEntryXdr;
  }

  /**
   * Parse a signed auth entry to extract game parameters
   */
  parseAuthEntry(authEntryXdr: string): {
    sessionId: number;
    player1: string;
    player1Points: bigint;
    functionName: string;
  } {
    try {
      const authEntry = xdr.SorobanAuthorizationEntry.fromXDR(
        authEntryXdr,
        "base64",
      );

      const credentials = authEntry.credentials();
      const addressCreds = credentials.address();
      const player1Address = addressCreds.address();
      const player1 = Address.fromScAddress(player1Address).toString();

      const rootInvocation = authEntry.rootInvocation();
      const authorizedFunction = rootInvocation.function();
      const contractFn = authorizedFunction.contractFn();
      const functionName = contractFn.functionName().toString();

      if (functionName !== "start_game") {
        throw new Error(`Unexpected function: ${functionName}`);
      }

      const args = contractFn.args();
      const sessionId = args[0].u32();
      const player1Points = args[1].i128().lo().toBigInt();

      return {
        sessionId,
        player1,
        player1Points,
        functionName,
      };
    } catch (err: any) {
      console.error("[parseAuthEntry] Error:", err);
      throw new Error(`Failed to parse auth entry: ${err.message}`);
    }
  }

  /**
   * STEP 2 (Player 2): Import Player 1's signed auth entry and rebuild transaction
   */
  async importAndSignAuthEntry(
    player1SignedAuthEntryXdr: string,
    player2Address: string,
    player2Points: bigint,
    player2Signer: Pick<
      contract.ClientOptions,
      "signTransaction" | "signAuthEntry"
    >,
    authTtlMinutes?: number,
  ): Promise<string> {
    console.log("[importAndSignAuthEntry] Parsing Player 1 auth entry...");

    const gameParams = this.parseAuthEntry(player1SignedAuthEntryXdr);

    if (player2Address === gameParams.player1) {
      throw new Error("Cannot play against yourself");
    }

    const buildClient = new PockerClient({
      contractId: this.contractId,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: RPC_URL,
      publicKey: player2Address,
    });

    let tx: any | undefined;
    let retries = 5;
    let lastError;

    while (retries > 0) {
      try {
        console.log(`[importAndSignAuthEntry] Building transaction (attempts left: ${retries})...`);

        if (retries < 5) {
          const jitter = Math.floor(Math.random() * 2000) + 500;
          await new Promise((resolve) => setTimeout(resolve, jitter));
        }

        tx = await buildClient.start_game(
          {
            session_id: gameParams.sessionId,
            player1: gameParams.player1,
            player2: player2Address,
            player1_points: gameParams.player1Points,
            player2_points: player2Points,
          },
          DEFAULT_METHOD_OPTIONS,
        );

        break;
      } catch (err: any) {
        lastError = err;
        console.warn("[importAndSignAuthEntry] Simulation failed:", err.message);

        if (
          err.message &&
          (err.message.includes("nonce already exists") ||
            err.message.includes("Auth, ExistingValue") ||
            err.message.includes("HostError"))
        ) {
          console.log("[importAndSignAuthEntry] Detected nonce error, retrying...");
          retries--;
        } else {
          throw err;
        }
      }
    }

    if (!tx) {
      if (lastError) throw lastError;
      throw new Error("Failed to build transaction");
    }

    const validUntilLedgerSeq = authTtlMinutes
      ? await calculateValidUntilLedger(RPC_URL, authTtlMinutes)
      : await calculateValidUntilLedger(RPC_URL, MULTI_SIG_AUTH_TTL_MINUTES);

    const txWithInjectedAuth = await injectSignedAuthEntry(
      tx,
      player1SignedAuthEntryXdr,
      player2Address,
      player2Signer,
      validUntilLedgerSeq,
    );

    const player2Client = this.createSigningClient(player2Address, player2Signer);
    const player2Tx = player2Client.txFromXDR(txWithInjectedAuth.toXDR());

    const needsSigning = await player2Tx.needsNonInvokerSigningBy();

    if (needsSigning.includes(player2Address)) {
      console.log("[importAndSignAuthEntry] Signing Player 2 auth entry");
      await player2Tx.signAuthEntries({ expiration: validUntilLedgerSeq });
    }

    return player2Tx.toXDR();
  }

  /**
   * STEP 3: Finalize and submit the transaction
   */
  async finalizeStartGame(
    xdr: string,
    signerAddress: string,
    signer: Pick<contract.ClientOptions, "signTransaction" | "signAuthEntry">,
    authTtlMinutes?: number,
  ) {
    const client = this.createSigningClient(signerAddress, signer);
    const tx = client.txFromXDR(xdr);

    await tx.simulate();

    const validUntilLedgerSeq = authTtlMinutes
      ? await calculateValidUntilLedger(RPC_URL, authTtlMinutes)
      : await calculateValidUntilLedger(RPC_URL, DEFAULT_AUTH_TTL_MINUTES);

    const sentTx = await signAndSendViaLaunchtube(
      tx,
      DEFAULT_METHOD_OPTIONS.timeoutInSeconds,
      validUntilLedgerSeq,
    );
    return sentTx;
  }

  /**
   * Submit a commitment for your hand (Poseidon hash)
   */
  async submitCommitment(
    sessionId: number,
    playerAddress: string,
    commitment: string,
    signer: Pick<contract.ClientOptions, "signTransaction" | "signAuthEntry">,
    authTtlMinutes?: number,
  ) {
    const client = this.createSigningClient(playerAddress, signer);
    
    const commitmentBytes = Buffer.from(commitment, 'utf-8');
    
    const tx = await client.submit_commitment(
      {
        session_id: sessionId,
        player: playerAddress,
        commitment: commitmentBytes,
      },
      DEFAULT_METHOD_OPTIONS,
    );

    const validUntilLedgerSeq = authTtlMinutes
      ? await calculateValidUntilLedger(RPC_URL, authTtlMinutes)
      : await calculateValidUntilLedger(RPC_URL, DEFAULT_AUTH_TTL_MINUTES);

    const sentTx = await signAndSendViaLaunchtube(
      tx,
      DEFAULT_METHOD_OPTIONS.timeoutInSeconds,
      validUntilLedgerSeq,
    );
    return sentTx.result;
  }

  /**
   * Reveal the winner using a ZK proof
   */
  async revealWinner(
    sessionId: number,
    playerAddress: string,
    proof: { pi_a: Buffer; pi_b: Buffer; pi_c: Buffer },
    publicSignals: Buffer[],
    signer: Pick<contract.ClientOptions, "signTransaction" | "signAuthEntry">,
    authTtlMinutes?: number,
  ) {
    const client = this.createSigningClient(playerAddress, signer);
    
    const tx = await client.reveal_winner(
      {
        session_id: sessionId,
        proof: proof,
        public_signals: publicSignals,
      },
      DEFAULT_METHOD_OPTIONS,
    );

    const validUntilLedgerSeq = authTtlMinutes
      ? await calculateValidUntilLedger(RPC_URL, authTtlMinutes)
      : await calculateValidUntilLedger(RPC_URL, DEFAULT_AUTH_TTL_MINUTES);

    const sentTx = await signAndSendViaLaunchtube(
      tx,
      DEFAULT_METHOD_OPTIONS.timeoutInSeconds,
      validUntilLedgerSeq,
    );
    return sentTx.result;
  }
}
