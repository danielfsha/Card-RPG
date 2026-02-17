import { useState, useEffect } from "react";
import { usePlayersList, myPlayer, isHost, getRoomCode } from "playroomkit";
import GlossyButton from "../components/GlossyButton";
import { useWallet } from "../hooks/useWallet";
import { useGameEngine } from "../hooks/useGameEngine";
import toast from "react-hot-toast";
import { ClipboardCopy, ClipboardCopyIcon } from "lucide-react";

interface LobbyScreenProps {
  onStartGame: () => void;
}

export function LobbyScreen({ onStartGame }: LobbyScreenProps) {
  const { publicKey, getContractSigner } = useWallet();
  const {
    sessionId,
    startGame: initGameSession,
    setP1AuthEntryXDR,
    p1AuthEntryXDR,
  } = useGameEngine();
  const players = usePlayersList(true);
  const me = myPlayer();
  const [isReady, setIsReady] = useState(false);
  const [allReady, setAllReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [hasImported, setHasImported] = useState(false);
  const host = isHost();
  const roomCode = getRoomCode() || "LOADING...";

  // Sync ready state to Playroom
  useEffect(() => {
    if (me) {
      me.setState("ready", isReady);
      me.setState("address", publicKey);
    }
  }, [isReady, me, publicKey]);

  // Guest: Auto-import auth entry when received from host
  useEffect(() => {
    if (!host && p1AuthEntryXDR && !isStarting && !hasImported) {
      console.log("[Guest] Received auth entry from host, auto-importing...");
      setHasImported(true);
      // Cancel any countdown - we need to wait for transaction
      setCountdown(null);
      handleGuestImportAndFinalize();
    }
  }, [host, p1AuthEntryXDR, isStarting, hasImported]);

  const handleGuestImportAndFinalize = async () => {
    setIsStarting(true);
    try {
      console.log("[Guest] Starting import and finalize process...");

      const { PockerService } = await import("../games/pocker/pockerService");
      const { POCKER_CONTRACT, NETWORK } = await import("../utils/constants");

      const pockerService = new PockerService(POCKER_CONTRACT);
      const signer = getContractSigner();

      // Parse auth entry to get game params
      console.log("[Guest] Parsing auth entry...");
      const gameParams = pockerService.parseAuthEntry(p1AuthEntryXDR);

      console.log("[Guest] Parsed game params:", gameParams);

      // Ensure Player 2 (guest) is funded on testnet
      if (NETWORK === "testnet" && publicKey) {
        try {
          console.log("[Guest] Checking if Player 2 is funded on testnet...");
          const horizonUrl = "https://horizon-testnet.stellar.org";
          const accountRes = await fetch(`${horizonUrl}/accounts/${publicKey}`);

          if (accountRes.status === 404) {
            console.log(
              "[Guest] Player 2 not funded, requesting from Friendbot...",
            );
            toast("Funding your account on testnet...", {
              icon: "💰",
              duration: 3000,
            });

            const fundRes = await fetch(
              `https://friendbot.stellar.org?addr=${publicKey}`,
            );
            if (fundRes.ok) {
              toast.success("Account funded!");
              // Wait a moment for Horizon to index
              await new Promise((r) => setTimeout(r, 2000));
            } else {
              throw new Error(
                "Failed to fund account. Please fund your wallet manually.",
              );
            }
          } else {
            console.log("[Guest] Player 2 already funded");
          }
        } catch (err) {
          console.error("[Guest] Error checking/funding account:", err);
          throw new Error(
            "Account funding required. Please fund your testnet wallet.",
          );
        }
      }

      // Default points: 0.1 XLM = 1000000 stroops
      const points = BigInt(1000000);

      console.log("[Guest] Importing and signing auth entry...");
      // Import and sign as Player 2
      const fullTxXDR = await pockerService.importAndSignAuthEntry(
        p1AuthEntryXDR,
        publicKey!,
        points,
        signer,
      );

      console.log("[Guest] Transaction signed, finalizing and submitting...");

      // Finalize and submit
      const sentTx = await pockerService.finalizeStartGame(
        fullTxXDR,
        publicKey!,
        signer,
      );

      console.log("[Guest] Transaction submitted! Checking status...");

      // Check transaction status
      if (sentTx.getTransactionResponse?.status === "FAILED") {
        throw new Error(
          "Transaction failed on-chain. Check console for details.",
        );
      }

      if (sentTx.getTransactionResponse?.status === "SUCCESS") {
        console.log("[Guest] Transaction successful!");
        toast.success("Game created successfully!");
      } else {
        console.log(
          "[Guest] Transaction status:",
          sentTx.getTransactionResponse?.status,
        );
      }

      // Wait longer for the transaction to be fully processed and indexed
      await new Promise((r) => setTimeout(r, 5000));

      // Verify game was created before navigating
      const { PockerService: VerifyService } =
        await import("../games/pocker/pockerService");
      const { POCKER_CONTRACT: VerifyContract } =
        await import("../utils/constants");
      const verifyService = new VerifyService(VerifyContract);

      let gameCreated = false;
      for (let i = 0; i < 5; i++) {
        const game = await verifyService.getGame(gameParams.sessionId);
        if (game) {
          console.log("[Guest] Game verified on-chain!");
          gameCreated = true;
          break;
        }
        console.log(`[Guest] Game not found yet, retrying (${i + 1}/5)...`);
        await new Promise((r) => setTimeout(r, 2000));
      }

      if (!gameCreated) {
        throw new Error(
          "Game was not created on-chain. Transaction may have failed.",
        );
      }

      onStartGame();
    } catch (err: any) {
      console.error("[Guest] Error importing auth entry:", err);
      console.error("[Guest] Error stack:", err.stack);
      toast.error(err.message || "Failed to join game");
      setIsStarting(false);
      setHasImported(false); // Allow retry
    }
  };

  // Check if all players are ready (only guests need to be ready, host starts manually)
  useEffect(() => {
    if (players.length === 2) {
      // For guests: check if they're ready
      // For host: they control start manually
      const guestPlayers = players.filter((p: any) => p.id !== players[0]?.id);
      const ready = guestPlayers.every(
        (p: any) => p.getState("ready") === true,
      );
      setAllReady(ready);

      // DISABLED: Countdown navigation conflicts with transaction-based game start
      // The guest's transaction needs to complete before navigation
      // Keeping countdown for visual feedback only
      if (ready && countdown === null && !host && !isStarting) {
        // Guest sees countdown when they're ready (visual only)
        setCountdown(5);
      } else if (!ready && countdown !== null) {
        // Reset countdown if guest becomes not ready
        setCountdown(null);
      }
    } else {
      setAllReady(false);
      setCountdown(null);
    }
  }, [players, countdown, host, isStarting]);

  // Countdown timer - DISABLED for poker (transaction-based start)
  // The countdown would navigate before the transaction completes
  useEffect(() => {
    if (countdown === null) return;

    // Don't navigate on countdown - wait for transaction to complete
    // The guest's handleGuestImportAndFinalize will call onStartGame when ready
    if (countdown === 0) {
      // Just stop the countdown, don't navigate
      setCountdown(null);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  const handleToggleReady = () => {
    setIsReady(!isReady);
  };

  const handleHostStartGame = async () => {
    if (players.length < 2) {
      toast.error("Need 2 players to start");
      return;
    }

    setIsStarting(true);
    try {
      // Initialize game session (generates session ID)
      const newSessionId = initGameSession();

      if (!newSessionId || newSessionId === 0) {
        toast.error("Failed to generate session ID");
        setIsStarting(false);
        return;
      }

      console.log("[Host] Using session ID:", newSessionId);

      // Import the service dynamically to avoid circular deps
      const { PockerService } = await import("../games/pocker/pockerService");
      const { POCKER_CONTRACT, NETWORK } = await import("../utils/constants");

      const pockerService = new PockerService(POCKER_CONTRACT);
      const signer = getContractSigner();

      // Get player addresses
      const sortedPlayers = [...players].sort((a, b) =>
        a.id.localeCompare(b.id),
      );
      const player1 = sortedPlayers[0].getState("address") || publicKey;
      const player2 = sortedPlayers[1].getState("address");

      if (!player2 || !player1) {
        toast.error("Player addresses not found");
        setIsStarting(false);
        return;
      }

      console.log("[Host] Preparing game with:", {
        sessionId: newSessionId,
        player1,
        player2,
      });

      // Ensure Player 1 is funded on testnet
      if (NETWORK === "testnet") {
        try {
          console.log("[Host] Checking if Player 1 is funded on testnet...");
          const horizonUrl = "https://horizon-testnet.stellar.org";
          const accountRes = await fetch(`${horizonUrl}/accounts/${player1}`);

          if (accountRes.status === 404) {
            console.log(
              "[Host] Player 1 not funded, requesting from Friendbot...",
            );
            toast("Funding your account on testnet...", {
              icon: "💰",
              duration: 3000,
            });

            const fundRes = await fetch(
              `https://friendbot.stellar.org?addr=${player1}`,
            );
            if (fundRes.ok) {
              toast.success("Account funded!");
              // Wait a moment for Horizon to index
              await new Promise((r) => setTimeout(r, 2000));
            } else {
              console.warn(
                "[Host] Friendbot funding failed, continuing anyway...",
              );
            }
          } else {
            console.log("[Host] Player 1 already funded");
          }
        } catch (err) {
          console.warn("[Host] Error checking/funding account:", err);
          // Continue anyway - might work
        }
      }

      // Default points: 0.1 XLM = 1000000 stroops
      const points = BigInt(1000000);

      // Use player2 as the transaction source for simulation
      // This is a placeholder - the actual transaction will be rebuilt by player2
      console.log("[Host] Using player2 as simulation source:", player2);

      // Host (Player 1) creates and signs auth entry
      const authEntryXDR = await pockerService.prepareStartGame(
        newSessionId,
        player1,
        player2, // Player 2 will be the transaction source
        points,
        points,
        signer,
      );

      console.log("[Host] Auth entry created, sharing via Playroom");

      // Share auth entry with Player 2 via Playroom
      setP1AuthEntryXDR(authEntryXDR);

      toast.success("Auth entry shared! Waiting for Player 2...");

      // Poll for game creation (Player 2 will finalize)
      const pollInterval = setInterval(async () => {
        try {
          const game = await pockerService.getGame(newSessionId);
          if (game) {
            console.log("[Host] Game created by Player 2!");
            clearInterval(pollInterval);
            toast.success("Game started!");
            onStartGame();
          }
        } catch (err) {
          // Keep polling
        }
      }, 3000);

      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setIsStarting(false);
      }, 300000);
    } catch (err: any) {
      console.error("[Host] Error starting game:", err);
      toast.error(err.message || "Failed to start game");
      setIsStarting(false);
    }
  };

  const copyRoomCode = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    navigator.clipboard.writeText(url);
    toast.success("Room link copied!");
  };

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 to-green-900 border-2 border-white/20 text-white p-4 w-full max-w-2xl rounded-sm">
        <h3 className="text-white text-3xl mb-8 text-center font-bold">
          GAME LOBBY
        </h3>

        {/* Room Code */}
        <div className="mb-8">
          <div className="text-white/70 text-sm mb-2 text-center">
            Room Code
          </div>
          <div className="flex items-center justify-center gap-4">
            <div className="text-white text-6xl tracking-wider font-bold">
              {roomCode}
            </div>
            <GlossyButton onClick={copyRoomCode} title="Copy room link" className="size-12">
                <ClipboardCopy />
            </GlossyButton>
          </div>
        </div>

        {/* Players List */}
        <div className="mb-8 space-y-3">
          <div className="text-white/70 text-sm mb-4 text-center">
            Players ({players.length}/2)
          </div>
          {players.map((player: any) => {
            const isMe = player.id === me?.id;
            const playerReady = player.getState("ready");
            const playerAddress = player.getState("address");

            return (
              <div
                key={player.id}
                className={`bg-white/5 p-4 rounded-xl border ${
                  isMe ? "border-blue-500/50" : "border-white/10"
                } flex items-center justify-between`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      playerReady ? "bg-green-500" : "bg-gray-500"
                    }`}
                  />
                  <div>
                    <div className="text-white text-sm">
                      {isMe ? "You" : "Opponent"}
                      {player.id === players[0]?.id && (
                        <span className="ml-2 text-yellow-500 text-xs">
                          HOST
                        </span>
                      )}
                    </div>
                    {playerAddress && (
                      <div className="text-white/50 text-xs font-mono">
                        {playerAddress.slice(0, 8)}...{playerAddress.slice(-4)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-white/70 text-sm">
                  {playerReady ? "Ready" : "Not Ready"}
                </div>
              </div>
            );
          })}

          {/* Empty slot */}
          {players.length < 2 && (
            <div className="bg-white/5 p-4 rounded-xl border border-dashed border-white/20 flex items-center justify-center">
              <div className="text-white/50 text-sm">
                Waiting for player to join...
              </div>
            </div>
          )}
        </div>

        {/* Ready Status Message */}
        {countdown !== null ? (
          <div className="mb-6 bg-green-500/20 border-2 border-green-500/50 rounded-xl p-6">
            <div className="text-center">
              <div className="text-6xl font-bold text-green-200 mb-2">
                {countdown}
              </div>
              <p className="text-green-200 text-lg">Game starting...</p>
            </div>
          </div>
        ) : players.length === 2 && allReady ? (
          <div className="mb-6 bg-green-500/20 border-2 border-green-500/50 rounded-xl p-4">
            <p className="text-green-200 text-center text-sm font-bold">
              All players ready! Starting game...
            </p>
          </div>
        ) : null}

        {players.length < 2 && (
          <div className="mb-6 p-4">
            <p className="text-center text-sm font-bold mx-auto">
              Share the room code with a friend to start playing
            </p>
          </div>
        )}

        {/* Ready/Start Button */}
        <div className="flex flex-col gap-4">
          {host ? (
            // Host sees "Start Game" button
            <GlossyButton
              onClick={handleHostStartGame}
              disabled={players.length < 2 || countdown !== null || isStarting}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isStarting ? "Starting..." : "Start Game"}
            </GlossyButton>
          ) : (
            // Guest sees "Ready" toggle button
            <GlossyButton
              onClick={handleToggleReady}
              disabled={players.length < 2 || countdown !== null}
              className={`w-full ${
                isReady
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {isReady ? "Not Ready" : "Ready"}
            </GlossyButton>
          )}
        </div>
      </div>
    </div>
  );
}
