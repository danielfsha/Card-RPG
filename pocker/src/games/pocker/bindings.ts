// @ts-nocheck
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
    contractId: "CBBVBGROB23SA4XUCJ7RLDAWSZASBOIFKLV5CBV5FLU6KQS3WLOEXNY7",
  }
} as const


export interface Game {
  community_cards: Array<u32>;
  community_commitment: Option<Buffer>;
  community_revealed: u32;
  current_actor: u32;
  last_action: Action;
  last_raise_amount: i128;
  phase: Phase;
  player1: string;
  player1_bet: i128;
  player1_hole_commitment: Option<Buffer>;
  player1_points: i128;
  player1_ranking: Option<u32>;
  player1_revealed: boolean;
  player1_stack: i128;
  player2: string;
  player2_bet: i128;
  player2_hole_commitment: Option<Buffer>;
  player2_points: i128;
  player2_ranking: Option<u32>;
  player2_revealed: boolean;
  player2_stack: i128;
  pot: i128;
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

export type Phase = {tag: "Commit", values: void} | {tag: "Preflop", values: void} | {tag: "Flop", values: void} | {tag: "Turn", values: void} | {tag: "River", values: void} | {tag: "Showdown", values: void} | {tag: "Complete", values: void};

export type Action = {tag: "None", values: void} | {tag: "Fold", values: void} | {tag: "Check", values: void} | {tag: "Call", values: void} | {tag: "Bet", values: readonly [i128]} | {tag: "Raise", values: readonly [i128]} | {tag: "AllIn", values: void};

export type DataKey = {tag: "Game", values: readonly [u32]} | {tag: "GameHubAddress", values: void} | {tag: "Admin", values: void} | {tag: "VerificationKey", values: void};


export interface Groth16Proof {
  pi_a: Buffer;
  pi_b: Buffer;
  pi_c: Buffer;
}


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
   * * `player1_points` - Points amount committed by player 1 (buy-in)
   * * `player2_points` - Points amount committed by player 2 (buy-in)
   */
  start_game: ({session_id, player1, player2, player1_points, player2_points}: {session_id: u32, player1: string, player2: string, player1_points: i128, player2_points: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a player_action transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Execute a betting action (fold, check, call, bet, raise, all-in)
   * 
   * # Arguments
   * * `session_id` - The session ID of the game
   * * `player` - Address of the player making the action
   * * `action` - The betting action to execute
   */
  player_action: ({session_id, player, action}: {session_id: u32, player: string, action: Action}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a reveal_winner transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Reveal the winner using a ZK proof
   * Verifies that revealed hands (2 hole cards + 5 community cards) match commitments and determines winner
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

  /**
   * Construct and simulate a submit_hole_commitment transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Submit a commitment for your 2 hole cards (Poseidon hash)
   * Players must commit before betting begins
   * 
   * # Arguments
   * * `session_id` - The session ID of the game
   * * `player` - Address of the player making the commitment
   * * `hole_commitment` - Poseidon hash of 2 hole cards + salt
   */
  submit_hole_commitment: ({session_id, player, hole_commitment}: {session_id: u32, player: string, hole_commitment: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a submit_community_commitment transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Submit community cards commitment (5 cards)
   * This should be done after hole cards are committed
   * 
   * # Arguments
   * * `session_id` - The session ID of the game
   * * `community_commitment` - Poseidon hash of 5 community cards + salt
   */
  submit_community_commitment: ({session_id, community_commitment}: {session_id: u32, community_commitment: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

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
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAABEdhbWUAAAAXAAAAAAAAAA9jb21tdW5pdHlfY2FyZHMAAAAD6gAAAAQAAAAAAAAAFGNvbW11bml0eV9jb21taXRtZW50AAAD6AAAAA4AAAAAAAAAEmNvbW11bml0eV9yZXZlYWxlZAAAAAAABAAAAAAAAAANY3VycmVudF9hY3RvcgAAAAAAAAQAAAAAAAAAC2xhc3RfYWN0aW9uAAAAB9AAAAAGQWN0aW9uAAAAAAAAAAAAEWxhc3RfcmFpc2VfYW1vdW50AAAAAAAACwAAAAAAAAAFcGhhc2UAAAAAAAfQAAAABVBoYXNlAAAAAAAAAAAAAAdwbGF5ZXIxAAAAABMAAAAAAAAAC3BsYXllcjFfYmV0AAAAAAsAAAAAAAAAF3BsYXllcjFfaG9sZV9jb21taXRtZW50AAAAA+gAAAAOAAAAAAAAAA5wbGF5ZXIxX3BvaW50cwAAAAAACwAAAAAAAAAPcGxheWVyMV9yYW5raW5nAAAAA+gAAAAEAAAAAAAAABBwbGF5ZXIxX3JldmVhbGVkAAAAAQAAAAAAAAANcGxheWVyMV9zdGFjawAAAAAAAAsAAAAAAAAAB3BsYXllcjIAAAAAEwAAAAAAAAALcGxheWVyMl9iZXQAAAAACwAAAAAAAAAXcGxheWVyMl9ob2xlX2NvbW1pdG1lbnQAAAAD6AAAAA4AAAAAAAAADnBsYXllcjJfcG9pbnRzAAAAAAALAAAAAAAAAA9wbGF5ZXIyX3JhbmtpbmcAAAAD6AAAAAQAAAAAAAAAEHBsYXllcjJfcmV2ZWFsZWQAAAABAAAAAAAAAA1wbGF5ZXIyX3N0YWNrAAAAAAAACwAAAAAAAAADcG90AAAAAAsAAAAAAAAABndpbm5lcgAAAAAD6AAAABM=",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACQAAAAAAAAAMR2FtZU5vdEZvdW5kAAAAAQAAAAAAAAAJTm90UGxheWVyAAAAAAAAAgAAAAAAAAAQQWxyZWFkeUNvbW1pdHRlZAAAAAMAAAAAAAAADE5vdENvbW1pdHRlZAAAAAQAAAAAAAAAD0FscmVhZHlSZXZlYWxlZAAAAAAFAAAAAAAAABBHYW1lQWxyZWFkeUVuZGVkAAAABgAAAAAAAAAMSW52YWxpZFByb29mAAAABwAAAAAAAAARSW52YWxpZENvbW1pdG1lbnQAAAAAAAAIAAAAAAAAAApOb3RJblBoYXNlAAAAAAAJ",
        "AAAAAgAAAAAAAAAAAAAABVBoYXNlAAAAAAAABwAAAAAAAAAAAAAABkNvbW1pdAAAAAAAAAAAAAAAAAAHUHJlZmxvcAAAAAAAAAAAAAAAAARGbG9wAAAAAAAAAAAAAAAEVHVybgAAAAAAAAAAAAAABVJpdmVyAAAAAAAAAAAAAAAAAAAIU2hvd2Rvd24AAAAAAAAAAAAAAAhDb21wbGV0ZQ==",
        "AAAAAgAAAAAAAAAAAAAABkFjdGlvbgAAAAAABwAAAAAAAAAAAAAABE5vbmUAAAAAAAAAAAAAAARGb2xkAAAAAAAAAAAAAAAFQ2hlY2sAAAAAAAAAAAAAAAAAAARDYWxsAAAAAQAAAAAAAAADQmV0AAAAAAEAAAALAAAAAQAAAAAAAAAFUmFpc2UAAAAAAAABAAAACwAAAAAAAAAAAAAABUFsbEluAAAA",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABAAAAAEAAAAAAAAABEdhbWUAAAABAAAABAAAAAAAAAAAAAAADkdhbWVIdWJBZGRyZXNzAAAAAAAAAAAAAAAAAAVBZG1pbgAAAAAAAAAAAAAAAAAAD1ZlcmlmaWNhdGlvbktleQA=",
        "AAAAAQAAAAAAAAAAAAAADEdyb3RoMTZQcm9vZgAAAAMAAAAAAAAABHBpX2EAAAPuAAAAQAAAAAAAAAAEcGlfYgAAA+4AAACAAAAAAAAAAARwaV9jAAAD7gAAAEA=",
        "AAAAAAAAAF5HZXQgdGhlIGN1cnJlbnQgR2FtZUh1YiBjb250cmFjdCBhZGRyZXNzCgojIFJldHVybnMKKiBgQWRkcmVzc2AgLSBUaGUgR2FtZUh1YiBjb250cmFjdCBhZGRyZXNzAAAAAAAHZ2V0X2h1YgAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAF5TZXQgYSBuZXcgR2FtZUh1YiBjb250cmFjdCBhZGRyZXNzCgojIEFyZ3VtZW50cwoqIGBuZXdfaHViYCAtIFRoZSBuZXcgR2FtZUh1YiBjb250cmFjdCBhZGRyZXNzAAAAAAAHc2V0X2h1YgAAAAABAAAAAAAAAAduZXdfaHViAAAAABMAAAAA",
        "AAAAAAAAAHFVcGRhdGUgdGhlIGNvbnRyYWN0IFdBU00gaGFzaCAodXBncmFkZSBjb250cmFjdCkKCiMgQXJndW1lbnRzCiogYG5ld193YXNtX2hhc2hgIC0gVGhlIGhhc2ggb2YgdGhlIG5ldyBXQVNNIGJpbmFyeQAAAAAAAAd1cGdyYWRlAAAAAAEAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAA=",
        "AAAAAAAAAHNHZXQgZ2FtZSBpbmZvcm1hdGlvbi4KCiMgQXJndW1lbnRzCiogYHNlc3Npb25faWRgIC0gVGhlIHNlc3Npb24gSUQgb2YgdGhlIGdhbWUKCiMgUmV0dXJucwoqIGBHYW1lYCAtIFRoZSBnYW1lIHN0YXRlAAAAAAhnZXRfZ2FtZQAAAAEAAAAAAAAACnNlc3Npb25faWQAAAAAAAQAAAABAAAD6QAAB9AAAAAER2FtZQAAAAM=",
        "AAAAAAAAAEhHZXQgdGhlIGN1cnJlbnQgYWRtaW4gYWRkcmVzcwoKIyBSZXR1cm5zCiogYEFkZHJlc3NgIC0gVGhlIGFkbWluIGFkZHJlc3MAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAAT",
        "AAAAAAAAAEpTZXQgYSBuZXcgYWRtaW4gYWRkcmVzcwoKIyBBcmd1bWVudHMKKiBgbmV3X2FkbWluYCAtIFRoZSBuZXcgYWRtaW4gYWRkcmVzcwAAAAAACXNldF9hZG1pbgAAAAAAAAEAAAAAAAAACW5ld19hZG1pbgAAAAAAABMAAAAA",
        "AAAAAAAAAZJTdGFydCBhIG5ldyBnYW1lIGJldHdlZW4gdHdvIHBsYXllcnMgd2l0aCBwb2ludHMuClRoaXMgY3JlYXRlcyBhIHNlc3Npb24gaW4gdGhlIEdhbWUgSHViIGFuZCBsb2NrcyBwb2ludHMgYmVmb3JlIHN0YXJ0aW5nIHRoZSBnYW1lLgoKIyBBcmd1bWVudHMKKiBgc2Vzc2lvbl9pZGAgLSBVbmlxdWUgc2Vzc2lvbiBpZGVudGlmaWVyICh1MzIpCiogYHBsYXllcjFgIC0gQWRkcmVzcyBvZiBmaXJzdCBwbGF5ZXIKKiBgcGxheWVyMmAgLSBBZGRyZXNzIG9mIHNlY29uZCBwbGF5ZXIKKiBgcGxheWVyMV9wb2ludHNgIC0gUG9pbnRzIGFtb3VudCBjb21taXR0ZWQgYnkgcGxheWVyIDEgKGJ1eS1pbikKKiBgcGxheWVyMl9wb2ludHNgIC0gUG9pbnRzIGFtb3VudCBjb21taXR0ZWQgYnkgcGxheWVyIDIgKGJ1eS1pbikAAAAAAApzdGFydF9nYW1lAAAAAAAFAAAAAAAAAApzZXNzaW9uX2lkAAAAAAAEAAAAAAAAAAdwbGF5ZXIxAAAAABMAAAAAAAAAB3BsYXllcjIAAAAAEwAAAAAAAAAOcGxheWVyMV9wb2ludHMAAAAAAAsAAAAAAAAADnBsYXllcjJfcG9pbnRzAAAAAAALAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAKNJbml0aWFsaXplIHRoZSBjb250cmFjdCB3aXRoIEdhbWVIdWIgYWRkcmVzcyBhbmQgYWRtaW4KCiMgQXJndW1lbnRzCiogYGFkbWluYCAtIEFkbWluIGFkZHJlc3MgKGNhbiB1cGdyYWRlIGNvbnRyYWN0KQoqIGBnYW1lX2h1YmAgLSBBZGRyZXNzIG9mIHRoZSBHYW1lSHViIGNvbnRyYWN0AAAAAA1fX2NvbnN0cnVjdG9yAAAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAhnYW1lX2h1YgAAABMAAAAA",
        "AAAAAAAAANlFeGVjdXRlIGEgYmV0dGluZyBhY3Rpb24gKGZvbGQsIGNoZWNrLCBjYWxsLCBiZXQsIHJhaXNlLCBhbGwtaW4pCgojIEFyZ3VtZW50cwoqIGBzZXNzaW9uX2lkYCAtIFRoZSBzZXNzaW9uIElEIG9mIHRoZSBnYW1lCiogYHBsYXllcmAgLSBBZGRyZXNzIG9mIHRoZSBwbGF5ZXIgbWFraW5nIHRoZSBhY3Rpb24KKiBgYWN0aW9uYCAtIFRoZSBiZXR0aW5nIGFjdGlvbiB0byBleGVjdXRlAAAAAAAADXBsYXllcl9hY3Rpb24AAAAAAAADAAAAAAAAAApzZXNzaW9uX2lkAAAAAAAEAAAAAAAAAAZwbGF5ZXIAAAAAABMAAAAAAAAABmFjdGlvbgAAAAAH0AAAAAZBY3Rpb24AAAAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAWpSZXZlYWwgdGhlIHdpbm5lciB1c2luZyBhIFpLIHByb29mClZlcmlmaWVzIHRoYXQgcmV2ZWFsZWQgaGFuZHMgKDIgaG9sZSBjYXJkcyArIDUgY29tbXVuaXR5IGNhcmRzKSBtYXRjaCBjb21taXRtZW50cyBhbmQgZGV0ZXJtaW5lcyB3aW5uZXIKCiMgQXJndW1lbnRzCiogYHNlc3Npb25faWRgIC0gVGhlIHNlc3Npb24gSUQgb2YgdGhlIGdhbWUKKiBgcHJvb2ZgIC0gR3JvdGgxNiBaSyBwcm9vZgoqIGBwdWJsaWNfc2lnbmFsc2AgLSBQdWJsaWMgc2lnbmFscyBmcm9tIHRoZSBwcm9vZiAoY29tbWl0bWVudHMsIHJhbmtpbmdzLCB3aW5uZXIpCgojIFJldHVybnMKKiBgQWRkcmVzc2AgLSBBZGRyZXNzIG9mIHRoZSB3aW5uaW5nIHBsYXllcgAAAAAADXJldmVhbF93aW5uZXIAAAAAAAADAAAAAAAAAApzZXNzaW9uX2lkAAAAAAAEAAAAAAAAAAVwcm9vZgAAAAAAB9AAAAAMR3JvdGgxNlByb29mAAAAAAAAAA5wdWJsaWNfc2lnbmFscwAAAAAD6gAAAA4AAAABAAAD6QAAABMAAAAD",
        "AAAAAAAAAFZHZXQgdGhlIGN1cnJlbnQgdmVyaWZpY2F0aW9uIGtleQoKIyBSZXR1cm5zCiogYFZlcmlmaWNhdGlvbktleWAgLSBUaGUgdmVyaWZpY2F0aW9uIGtleQAAAAAAFGdldF92ZXJpZmljYXRpb25fa2V5AAAAAAAAAAEAAAPoAAAH0AAAAA9WZXJpZmljYXRpb25LZXkA",
        "AAAAAAAAAHBTZXQgdGhlIHZlcmlmaWNhdGlvbiBrZXkgZm9yIFpLIHByb29mIHZlcmlmaWNhdGlvbgoKIyBBcmd1bWVudHMKKiBgdmtgIC0gVGhlIHZlcmlmaWNhdGlvbiBrZXkgZnJvbSB0cnVzdGVkIHNldHVwAAAAFHNldF92ZXJpZmljYXRpb25fa2V5AAAAAQAAAAAAAAACdmsAAAAAB9AAAAAPVmVyaWZpY2F0aW9uS2V5AAAAAAA=",
        "AAAAAAAAARBTdWJtaXQgYSBjb21taXRtZW50IGZvciB5b3VyIDIgaG9sZSBjYXJkcyAoUG9zZWlkb24gaGFzaCkKUGxheWVycyBtdXN0IGNvbW1pdCBiZWZvcmUgYmV0dGluZyBiZWdpbnMKCiMgQXJndW1lbnRzCiogYHNlc3Npb25faWRgIC0gVGhlIHNlc3Npb24gSUQgb2YgdGhlIGdhbWUKKiBgcGxheWVyYCAtIEFkZHJlc3Mgb2YgdGhlIHBsYXllciBtYWtpbmcgdGhlIGNvbW1pdG1lbnQKKiBgaG9sZV9jb21taXRtZW50YCAtIFBvc2VpZG9uIGhhc2ggb2YgMiBob2xlIGNhcmRzICsgc2FsdAAAABZzdWJtaXRfaG9sZV9jb21taXRtZW50AAAAAAADAAAAAAAAAApzZXNzaW9uX2lkAAAAAAAEAAAAAAAAAAZwbGF5ZXIAAAAAABMAAAAAAAAAD2hvbGVfY29tbWl0bWVudAAAAAAOAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAANxTdWJtaXQgY29tbXVuaXR5IGNhcmRzIGNvbW1pdG1lbnQgKDUgY2FyZHMpClRoaXMgc2hvdWxkIGJlIGRvbmUgYWZ0ZXIgaG9sZSBjYXJkcyBhcmUgY29tbWl0dGVkCgojIEFyZ3VtZW50cwoqIGBzZXNzaW9uX2lkYCAtIFRoZSBzZXNzaW9uIElEIG9mIHRoZSBnYW1lCiogYGNvbW11bml0eV9jb21taXRtZW50YCAtIFBvc2VpZG9uIGhhc2ggb2YgNSBjb21tdW5pdHkgY2FyZHMgKyBzYWx0AAAAG3N1Ym1pdF9jb21tdW5pdHlfY29tbWl0bWVudAAAAAACAAAAAAAAAApzZXNzaW9uX2lkAAAAAAAEAAAAAAAAABRjb21tdW5pdHlfY29tbWl0bWVudAAAAA4AAAABAAAD6QAAAAIAAAAD",
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
        player_action: this.txFromJSON<Result<void>>,
        reveal_winner: this.txFromJSON<Result<string>>,
        get_verification_key: this.txFromJSON<Option<VerificationKey>>,
        set_verification_key: this.txFromJSON<null>,
        submit_hole_commitment: this.txFromJSON<Result<void>>,
        submit_community_commitment: this.txFromJSON<Result<void>>
  }
}