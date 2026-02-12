const {
  Keypair,
  Contract,
  TransactionBuilder,
  rpc,
  xdr,
  Address,
  authorizeEntry,
  TimeoutInfinite,
} = require("@stellar/stellar-sdk");

interface GameParams {
  sessionId: number;
  player1: string;
  player1Points: bigint;
  functionName: string;
}

/**
 * Parse a signed auth entry to extract game parameters
 */
function parseAuthEntry(authEntryXdr: string): GameParams {
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
      throw new Error(
        `Unexpected function: ${functionName}. Expected start_game.`,
      );
    }

    const args = contractFn.args();
    if (!args || args.length !== 2) {
      throw new Error(
        `Expected 2 arguments for start_game auth entry, got ${args ? args.length : "undefined"}`,
      );
    }

    const sessionId = args[0]?.u32?.();
    const player1Points = args[1]?.i128?.()?.lo?.()?.toBigInt?.();

    if (sessionId === undefined || player1Points === undefined) {
      throw new Error(
        "Failed to extract sessionId or player1Points from auth entry arguments.",
      );
    }

    return {
      sessionId,
      player1,
      player1Points,
      functionName,
    };
  } catch (err: any) {
    console.error("Error parsing auth entry:", err);
    throw new Error(`Failed to parse auth entry: ${err.message}`);
  }
}

interface ImportSignResult {
  status: string;
  hash: string;
  params: {
    p1: string;
    p2: string;
    sessionId: number;
  };
}

async function processImportAndSign(
  authEntryXDR: string,
  player2Points: string,
  contractId: string,
  aiWalletSecret: string,
  rpcUrl: string,
  networkPassphrase: string,
): Promise<ImportSignResult> {
  // 1. Setup Backend Wallet (AI Player 2)
  const backendKeypair = Keypair.fromSecret(aiWalletSecret);
  const player2Address = backendKeypair.publicKey();
  const server = new rpc.Server(rpcUrl);

  // 2. Parse User (Player 1) Auth Entry
  const gameParams = parseAuthEntry(authEntryXDR);
  console.log("Parsed Game Params:", gameParams);

  // Validate: P2 cannot be P1
  if (gameParams.player1 === player2Address) {
    throw new Error("AI cannot play against itself");
  }

  // 3. Load Backend Account
  console.log("Loading AI account:", player2Address);
  const sourceAccount = await server.getAccount(player2Address);

  // 4. Build Transaction (AI is Source)
  const contract = new Contract(contractId);
  // Convert points to BigInt
  const p2PointsBI = BigInt(player2Points);

  const op = contract.call(
    "start_game",
    xdr.ScVal.scvU32(gameParams.sessionId),
    Address.fromString(gameParams.player1).toScVal(),
    Address.fromString(player2Address).toScVal(),
    xdr.ScVal.scvI128(
      (() => {
        // Convert BigInt to lo/hi parts (lo: lower 64 bits, hi: upper 64 bits)
        const value = BigInt(gameParams.player1Points);
        const mask = BigInt("0xFFFFFFFFFFFFFFFF");
        const lo = (value & mask).toString();
        const hi = ((value >> BigInt(64)) & mask).toString();
        return new xdr.Int128Parts({
          lo: xdr.Uint64.fromString(lo),
          hi: xdr.Uint64.fromString(hi),
        });
      })(),
    ),
    xdr.ScVal.scvI128(
      (() => {
        // Convert BigInt to lo/hi parts (lo: lower 64 bits, hi: upper 64 bits)
        const value = BigInt(p2PointsBI);
        const mask = BigInt("0xFFFFFFFFFFFFFFFF");
        const lo = (value & mask).toString();
        const hi = ((value >> BigInt(64)) & mask).toString();
        return new xdr.Int128Parts({
          lo: xdr.Uint64.fromString(lo),
          hi: xdr.Uint64.fromString(hi),
        });
      })(),
    ),
  );

  const tx = new TransactionBuilder(sourceAccount, {
    fee: "100", // Standard fee
    networkPassphrase: networkPassphrase,
  })
    .addOperation(op)
    .setTimeout(TimeoutInfinite)
    .build();

  // 5. Simulate to get Auth Stubs
  console.log("Simulating transaction...");

  const simulated = await server.simulateTransaction(tx);

  if (!rpc.Api.isSimulationSuccess(simulated)) {
    console.error("Simulation failed:", simulated);
    throw new Error(
      `Transaction simulation failed: ${JSON.stringify(simulated)}`,
    );
  }

  // 6. Inject Auth Entries
  const authEntries = simulated.result!.auth; // Exists on success
  console.log(`Found ${authEntries.length} auth entries`);

  // Parse provided P1 Auth Entry
  const p1AuthEntry = xdr.SorobanAuthorizationEntry.fromXDR(
    authEntryXDR,
    "base64",
  );
  const p1AddressStr = gameParams.player1;

  let p1Found = false;
  let p2Found = false;

  // We need to modify the auth entries array
  for (let i = 0; i < authEntries.length; i++) {
    const entry = authEntries[i];
    if (!entry) continue;
    const creds = entry.credentials();

    if (creds.switch().name === "sorobanCredentialsAddress") {
      const addr = Address.fromScAddress(creds.address().address()).toString();

      if (addr === p1AddressStr) {
        // Replace P1 Stub with Signed Entry
        console.log(`Replacing P1 stub at index ${i}`);
        authEntries[i] = p1AuthEntry;
        p1Found = true;
      } else if (addr === player2Address) {
        // Sign P2 Entry
        console.log(`Signing P2 entry at index ${i}`);
        // authorizeEntry helper handles expiration and signing
        const signedEntry = await authorizeEntry(
          entry,
          async (preimage: any) => {
            // Ensure preimage is a Buffer before signing
            const preimageBuffer = Buffer.isBuffer(preimage)
              ? preimage
              : Buffer.from(preimage.toXDR());
            const signature = backendKeypair.sign(preimageBuffer);
            return Buffer.from(signature);
          },
          (await server.getLatestLedger()).sequence + 100, // Valid until
          networkPassphrase,
        );
        authEntries[i] = signedEntry;
        p2Found = true;
      }
    }
  }

  if (!p1Found) {
    throw new Error("Player 1 auth stub not found in simulation");
  }

  // 7. Reconstruct Transaction with Signed Auth
  const invokeHostFnOp = op.body().invokeHostFunctionOp();
  invokeHostFnOp.auth(authEntries);

  // Now rebuild the transaction with the updated operation AND the soroban data
  const transactionData = simulated.transactionData!.build(); // XDR

  // Since `tx` is already built, we can't easily "update" it via builder methods for soroban data (in older SDKs).
  // We use finalTx for the actual submission, so we don't strictly need to update tx here.
  // tx.setSorobanData(transactionData);

  // And we modified `op` in place (it's a reference to the XDR object)?
  // `builder.addOperation(op)` pushes it to internal array.
  // If strict, we should rebuild:
  const finalTx = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase: networkPassphrase,
  })
    .addOperation(op) // op now has `auth` set
    .setTimeout(TimeoutInfinite)
    .build();

  // setSorobanData is not available on Transaction, so set sorobanData via inner XDR
  // @ts-ignore: access private property or use casting if method missing in types
  (finalTx as any).setSorobanData(transactionData);

  // 8. Sign Transaction (AI)
  finalTx.sign(backendKeypair);

  // 9. Submit
  console.log("Submitting transaction...");
  const result = await server.sendTransaction(finalTx);

  if (
    result.status === "ERROR" ||
    result.status === "DUPLICATE" ||
    result.status === "TRY_AGAIN_LATER"
  ) {
    // ERROR
    console.error("Submission failed details:", result);
    throw new Error(`Submission failed: ${result.status}`);
  }

  return {
    status: result.status,
    hash: result.hash,
    params: {
      p1: gameParams.player1,
      p2: player2Address,
      sessionId: gameParams.sessionId,
    },
  };
}

export { parseAuthEntry, processImportAndSign };
