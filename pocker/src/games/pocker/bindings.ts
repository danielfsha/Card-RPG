import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CBVHGAN3B75DWRX5ZQ4I4EH5FOYOD745Y47OAYLVNPB2JJTMUDO7LAQ5",
  }
} as const


export interface Game {
  phase: Phase;
  player1: string;
  player1_commitment: Option<Buffer>;
  player1_points: i128;
  player1_ranking: Option<u32>;
  player1_revealed: boolean;
  player2: string;
  player2_commitment: Option<Buffer>;
  player2_points: i128;
  player2_ranking: Option<u32>;
  player2_revealed: boolean;
  winner: Option<string>;
}

export const Errors = {
  1: {message:"GameNotFound"},
  2: {message:"NotPlayer"},
  3: {message:"AlreadyCommitted"},
  4: {message:"NotCommitted"},
  5: {message:"AlreadyRevealed"},
  6: {message:"GameAlreadyEnded"},
  7: {message:"InvalidProof"},
  8: {message:"InvalidCommitment"},
  9: {message:"NotInPhase"}
}

export type Phase = {tag: "Commit", values: void} | {tag: "Reveal", values: void} | {tag: "Complete", values: void};

export type DataKey = {tag: "Game", values: readonly [u32]} | {tag: "GameHubAddress", values: void} | {tag: "Admin", values: void} | {tag: "VerificationKey", values: void};


export interface Groth16Proof {
  pi_a: Buffer;
  pi_b: Buffer;
  pi_c: Buffer;
}


export interface VerificationKey {
  alpha: Buffer;
  beta: Buffer;
  delta: Buffer;
  gamma: Buffer;
  ic: Array<Buffer>;
}

export const VerificationError = {
  1: {message:"InvalidProofStructure"},
  2: {message:"InvalidVerificationKey"},
  3: {message:"InvalidPublicInputs"},
  4: {message:"InvalidPoint"},
  5: {message:"PairingCheckFailed"}
}

export interface Client {
  /**
   * Construct and simulate a get_hub transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the current GameHub contract address
   * 
   * # Returns
   * * `Address` - The GameHub contract address
   */
  get_hub: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a set_hub transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set a new GameHub contract address
   * 
   * # Arguments
   * * `new_hub` - The new GameHub contract address
   */
  set_hub: ({new_hub}: {new_hub: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update the contract WASM hash (upgrade contract)
   * 
   * # Arguments
   * * `new_wasm_hash` - The hash of the new WASM binary
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get game information.
   * 
   * # Arguments
   * * `session_id` - The session ID of the game
   * 
   * # Returns
   * * `Game` - The game state
   */
  get_game: ({session_id}: {session_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Game>>>

  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the current admin address
   * 
   * # Returns
   * * `Address` - The admin address
   */
  get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set a new admin address
   * 
   * # Arguments
   * * `new_admin` - The new admin address
   */
  set_admin: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a start_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Start a new game between two players with points.
   * This creates a session in the Game Hub and locks points before starting the game.
   * 
   * # Arguments
   * * `session_id` - Unique session identifier (u32)
   * * `player1` - Address of first player
   * * `player2` - Address of second player
   * * `player1_points` - Points amount committed by player 1
   * * `player2_points` - Points amount committed by player 2
   */
  start_game: ({session_id, player1, player2, player1_points, player2_points}: {session_id: u32, player1: string, player2: string, player1_points: i128, player2_points: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a reveal_winner transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Reveal the winner using a ZK proof
   * Verifies that revealed cards match commitments and determines winner
   * 
   * # Arguments
   * * `session_id` - The session ID of the game
   * * `proof` - Groth16 ZK proof
   * * `public_signals` - Public signals from the proof (commitments, rankings, winner)
   * 
   * # Returns
   * * `Address` - Address of the winning player
   */
  reveal_winner: ({session_id, proof, public_signals}: {session_id: u32, proof: Groth16Proof, public_signals: Array<Buffer>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a submit_commitment transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Submit a commitment for your hand (Poseidon hash)
   * Players must commit before revealing
   * 
   * # Arguments
   * * `session_id` - The session ID of the game
   * * `player` - Address of the player making the commitment
   * * `commitment` - Poseidon hash of cards + salt
   */
  submit_commitment: ({session_id, player, commitment}: {session_id: u32, player: string, commitment: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_verification_key transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the current verification key
   * 
   * # Returns
   * * `VerificationKey` - The verification key
   */
  get_verification_key: (options?: MethodOptions) => Promise<AssembledTransaction<Option<VerificationKey>>>

  /**
   * Construct and simulate a set_verification_key transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set the verification key for ZK proof verification
   * 
   * # Arguments
   * * `vk` - The verification key from trusted setup
   */
  set_verification_key: ({vk}: {vk: VerificationKey}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, game_hub}: {admin: string, game_hub: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, game_hub}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAABEdhbWUAAAAMAAAAAAAAAAVwaGFzZQAAAAAAB9AAAAAFUGhhc2UAAAAAAAAAAAAAB3BsYXllcjEAAAAAEwAAAAAAAAAScGxheWVyMV9jb21taXRtZW50AAAAAAPoAAAADgAAAAAAAAAOcGxheWVyMV9wb2ludHMAAAAAAAsAAAAAAAAAD3BsYXllcjFfcmFua2luZwAAAAPoAAAABAAAAAAAAAAQcGxheWVyMV9yZXZlYWxlZAAAAAEAAAAAAAAAB3BsYXllcjIAAAAAEwAAAAAAAAAScGxheWVyMl9jb21taXRtZW50AAAAAAPoAAAADgAAAAAAAAAOcGxheWVyMl9wb2ludHMAAAAAAAsAAAAAAAAAD3BsYXllcjJfcmFua2luZwAAAAPoAAAABAAAAAAAAAAQcGxheWVyMl9yZXZlYWxlZAAAAAEAAAAAAAAABndpbm5lcgAAAAAD6AAAABM=",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACQAAAAAAAAAMR2FtZU5vdEZvdW5kAAAAAQAAAAAAAAAJTm90UGxheWVyAAAAAAAAAgAAAAAAAAAQQWxyZWFkeUNvbW1pdHRlZAAAAAMAAAAAAAAADE5vdENvbW1pdHRlZAAAAAQAAAAAAAAAD0FscmVhZHlSZXZlYWxlZAAAAAAFAAAAAAAAABBHYW1lQWxyZWFkeUVuZGVkAAAABgAAAAAAAAAMSW52YWxpZFByb29mAAAABwAAAAAAAAARSW52YWxpZENvbW1pdG1lbnQAAAAAAAAIAAAAAAAAAApOb3RJblBoYXNlAAAAAAAJ",
        "AAAAAgAAAAAAAAAAAAAABVBoYXNlAAAAAAAAAwAAAAAAAAAAAAAABkNvbW1pdAAAAAAAAAAAAAAAAAAGUmV2ZWFsAAAAAAAAAAAAAAAAAAhDb21wbGV0ZQ==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABAAAAAEAAAAAAAAABEdhbWUAAAABAAAABAAAAAAAAAAAAAAADkdhbWVIdWJBZGRyZXNzAAAAAAAAAAAAAAAAAAVBZG1pbgAAAAAAAAAAAAAAAAAAD1ZlcmlmaWNhdGlvbktleQA=",
        "AAAAAQAAAAAAAAAAAAAADEdyb3RoMTZQcm9vZgAAAAMAAAAAAAAABHBpX2EAAAPuAAAAQAAAAAAAAAAEcGlfYgAAA+4AAACAAAAAAAAAAARwaV9jAAAD7gAAAEA=",
        "AAAAAAAAAF5HZXQgdGhlIGN1cnJlbnQgR2FtZUh1YiBjb250cmFjdCBhZGRyZXNzCgojIFJldHVybnMKKiBgQWRkcmVzc2AgLSBUaGUgR2FtZUh1YiBjb250cmFjdCBhZGRyZXNzAAAAAAAHZ2V0X2h1YgAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAF5TZXQgYSBuZXcgR2FtZUh1YiBjb250cmFjdCBhZGRyZXNzCgojIEFyZ3VtZW50cwoqIGBuZXdfaHViYCAtIFRoZSBuZXcgR2FtZUh1YiBjb250cmFjdCBhZGRyZXNzAAAAAAAHc2V0X2h1YgAAAAABAAAAAAAAAAduZXdfaHViAAAAABMAAAAA",
        "AAAAAAAAAHFVcGRhdGUgdGhlIGNvbnRyYWN0IFdBU00gaGFzaCAodXBncmFkZSBjb250cmFjdCkKCiMgQXJndW1lbnRzCiogYG5ld193YXNtX2hhc2hgIC0gVGhlIGhhc2ggb2YgdGhlIG5ldyBXQVNNIGJpbmFyeQAAAAAAAAd1cGdyYWRlAAAAAAEAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAA=",
        "AAAAAAAAAHNHZXQgZ2FtZSBpbmZvcm1hdGlvbi4KCiMgQXJndW1lbnRzCiogYHNlc3Npb25faWRgIC0gVGhlIHNlc3Npb24gSUQgb2YgdGhlIGdhbWUKCiMgUmV0dXJucwoqIGBHYW1lYCAtIFRoZSBnYW1lIHN0YXRlAAAAAAhnZXRfZ2FtZQAAAAEAAAAAAAAACnNlc3Npb25faWQAAAAAAAQAAAABAAAD6QAAB9AAAAAER2FtZQAAAAM=",
        "AAAAAAAAAEhHZXQgdGhlIGN1cnJlbnQgYWRtaW4gYWRkcmVzcwoKIyBSZXR1cm5zCiogYEFkZHJlc3NgIC0gVGhlIGFkbWluIGFkZHJlc3MAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAAT",
        "AAAAAAAAAEpTZXQgYSBuZXcgYWRtaW4gYWRkcmVzcwoKIyBBcmd1bWVudHMKKiBgbmV3X2FkbWluYCAtIFRoZSBuZXcgYWRtaW4gYWRkcmVzcwAAAAAACXNldF9hZG1pbgAAAAAAAAEAAAAAAAAACW5ld19hZG1pbgAAAAAAABMAAAAA",
        "AAAAAAAAAYBTdGFydCBhIG5ldyBnYW1lIGJldHdlZW4gdHdvIHBsYXllcnMgd2l0aCBwb2ludHMuClRoaXMgY3JlYXRlcyBhIHNlc3Npb24gaW4gdGhlIEdhbWUgSHViIGFuZCBsb2NrcyBwb2ludHMgYmVmb3JlIHN0YXJ0aW5nIHRoZSBnYW1lLgoKIyBBcmd1bWVudHMKKiBgc2Vzc2lvbl9pZGAgLSBVbmlxdWUgc2Vzc2lvbiBpZGVudGlmaWVyICh1MzIpCiogYHBsYXllcjFgIC0gQWRkcmVzcyBvZiBmaXJzdCBwbGF5ZXIKKiBgcGxheWVyMmAgLSBBZGRyZXNzIG9mIHNlY29uZCBwbGF5ZXIKKiBgcGxheWVyMV9wb2ludHNgIC0gUG9pbnRzIGFtb3VudCBjb21taXR0ZWQgYnkgcGxheWVyIDEKKiBgcGxheWVyMl9wb2ludHNgIC0gUG9pbnRzIGFtb3VudCBjb21taXR0ZWQgYnkgcGxheWVyIDIAAAAKc3RhcnRfZ2FtZQAAAAAABQAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAAAAAAHcGxheWVyMQAAAAATAAAAAAAAAAdwbGF5ZXIyAAAAABMAAAAAAAAADnBsYXllcjFfcG9pbnRzAAAAAAALAAAAAAAAAA5wbGF5ZXIyX3BvaW50cwAAAAAACwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAKNJbml0aWFsaXplIHRoZSBjb250cmFjdCB3aXRoIEdhbWVIdWIgYWRkcmVzcyBhbmQgYWRtaW4KCiMgQXJndW1lbnRzCiogYGFkbWluYCAtIEFkbWluIGFkZHJlc3MgKGNhbiB1cGdyYWRlIGNvbnRyYWN0KQoqIGBnYW1lX2h1YmAgLSBBZGRyZXNzIG9mIHRoZSBHYW1lSHViIGNvbnRyYWN0AAAAAA1fX2NvbnN0cnVjdG9yAAAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAhnYW1lX2h1YgAAABMAAAAA",
        "AAAAAAAAAUdSZXZlYWwgdGhlIHdpbm5lciB1c2luZyBhIFpLIHByb29mClZlcmlmaWVzIHRoYXQgcmV2ZWFsZWQgY2FyZHMgbWF0Y2ggY29tbWl0bWVudHMgYW5kIGRldGVybWluZXMgd2lubmVyCgojIEFyZ3VtZW50cwoqIGBzZXNzaW9uX2lkYCAtIFRoZSBzZXNzaW9uIElEIG9mIHRoZSBnYW1lCiogYHByb29mYCAtIEdyb3RoMTYgWksgcHJvb2YKKiBgcHVibGljX3NpZ25hbHNgIC0gUHVibGljIHNpZ25hbHMgZnJvbSB0aGUgcHJvb2YgKGNvbW1pdG1lbnRzLCByYW5raW5ncywgd2lubmVyKQoKIyBSZXR1cm5zCiogYEFkZHJlc3NgIC0gQWRkcmVzcyBvZiB0aGUgd2lubmluZyBwbGF5ZXIAAAAADXJldmVhbF93aW5uZXIAAAAAAAADAAAAAAAAAApzZXNzaW9uX2lkAAAAAAAEAAAAAAAAAAVwcm9vZgAAAAAAB9AAAAAMR3JvdGgxNlByb29mAAAAAAAAAA5wdWJsaWNfc2lnbmFscwAAAAAD6gAAAA4AAAABAAAD6QAAABMAAAAD",
        "AAAAAAAAAPdTdWJtaXQgYSBjb21taXRtZW50IGZvciB5b3VyIGhhbmQgKFBvc2VpZG9uIGhhc2gpClBsYXllcnMgbXVzdCBjb21taXQgYmVmb3JlIHJldmVhbGluZwoKIyBBcmd1bWVudHMKKiBgc2Vzc2lvbl9pZGAgLSBUaGUgc2Vzc2lvbiBJRCBvZiB0aGUgZ2FtZQoqIGBwbGF5ZXJgIC0gQWRkcmVzcyBvZiB0aGUgcGxheWVyIG1ha2luZyB0aGUgY29tbWl0bWVudAoqIGBjb21taXRtZW50YCAtIFBvc2VpZG9uIGhhc2ggb2YgY2FyZHMgKyBzYWx0AAAAABFzdWJtaXRfY29tbWl0bWVudAAAAAAAAAMAAAAAAAAACnNlc3Npb25faWQAAAAAAAQAAAAAAAAABnBsYXllcgAAAAAAEwAAAAAAAAAKY29tbWl0bWVudAAAAAAADgAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAFZHZXQgdGhlIGN1cnJlbnQgdmVyaWZpY2F0aW9uIGtleQoKIyBSZXR1cm5zCiogYFZlcmlmaWNhdGlvbktleWAgLSBUaGUgdmVyaWZpY2F0aW9uIGtleQAAAAAAFGdldF92ZXJpZmljYXRpb25fa2V5AAAAAAAAAAEAAAPoAAAH0AAAAA9WZXJpZmljYXRpb25LZXkA",
        "AAAAAAAAAHBTZXQgdGhlIHZlcmlmaWNhdGlvbiBrZXkgZm9yIFpLIHByb29mIHZlcmlmaWNhdGlvbgoKIyBBcmd1bWVudHMKKiBgdmtgIC0gVGhlIHZlcmlmaWNhdGlvbiBrZXkgZnJvbSB0cnVzdGVkIHNldHVwAAAAFHNldF92ZXJpZmljYXRpb25fa2V5AAAAAQAAAAAAAAACdmsAAAAAB9AAAAAPVmVyaWZpY2F0aW9uS2V5AAAAAAA=",
        "AAAAAQAAAAAAAAAAAAAADEdyb3RoMTZQcm9vZgAAAAMAAAAAAAAABHBpX2EAAAPuAAAAQAAAAAAAAAAEcGlfYgAAA+4AAACAAAAAAAAAAARwaV9jAAAD7gAAAEA=",
        "AAAAAQAAAAAAAAAAAAAAD1ZlcmlmaWNhdGlvbktleQAAAAAFAAAAAAAAAAVhbHBoYQAAAAAAA+4AAABAAAAAAAAAAARiZXRhAAAD7gAAAIAAAAAAAAAABWRlbHRhAAAAAAAD7gAAAIAAAAAAAAAABWdhbW1hAAAAAAAD7gAAAIAAAAAAAAAAAmljAAAAAAPqAAAD7gAAAEA=",
        "AAAABAAAAAAAAAAAAAAAEVZlcmlmaWNhdGlvbkVycm9yAAAAAAAABQAAAAAAAAAVSW52YWxpZFByb29mU3RydWN0dXJlAAAAAAAAAQAAAAAAAAAWSW52YWxpZFZlcmlmaWNhdGlvbktleQAAAAAAAgAAAAAAAAATSW52YWxpZFB1YmxpY0lucHV0cwAAAAADAAAAAAAAAAxJbnZhbGlkUG9pbnQAAAAEAAAAAAAAABJQYWlyaW5nQ2hlY2tGYWlsZWQAAAAAAAU=" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_hub: this.txFromJSON<string>,
        set_hub: this.txFromJSON<null>,
        upgrade: this.txFromJSON<null>,
        get_game: this.txFromJSON<Result<Game>>,
        get_admin: this.txFromJSON<string>,
        set_admin: this.txFromJSON<null>,
        start_game: this.txFromJSON<Result<void>>,
        reveal_winner: this.txFromJSON<Result<string>>,
        submit_commitment: this.txFromJSON<Result<void>>,
        get_verification_key: this.txFromJSON<Option<VerificationKey>>,
        set_verification_key: this.txFromJSON<null>
  }
}
