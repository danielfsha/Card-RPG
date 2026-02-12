import { useState, useEffect, useRef } from "react";
import { getRoomCode } from "playroomkit";
import { Toaster, toast } from "react-hot-toast"; // Add Toaster import
import { CardRpgService } from "./cardRpgService";
import { requestCache, createCacheKey } from "@/utils/requestCache";
import { useWallet } from "@/hooks/useWallet";
import { useGameEngine } from "@/hooks/useGameEngine"; // Import the game engine hook
import { CARD_RPG_CONTRACT } from "@/utils/constants";
import { getFundedSimulationSourceAddress } from "@/utils/simulationUtils";
import {
  devWalletService,
  DevWalletService,
} from "@/services/devWalletService";
import type { Game } from "./bindings";
import { MultiplayerLobby } from "./components/MultiplayerLobby";
import { GameHeader } from "./components/GameHeader";
import { SetupScreen } from "./components/SetupScreen";
import { ActiveGame } from "./components/ActiveGame";

const createRandomSessionId = (): number => {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    let value = 0;
    const buffer = new Uint32Array(1);
    while (value === 0) {
      crypto.getRandomValues(buffer);
      value = buffer[0];
    }
    return value;
  }
  return Math.floor(Math.random() * 0xffffffff) >>> 0 || 1;
};

const cardRpgService = new CardRpgService(CARD_RPG_CONTRACT);

interface CardRpgGameProps {
  userAddress: string;
  currentEpoch: number;
  availablePoints: bigint;
  initialXDR?: string | null;
  initialSessionId?: number | null;
  onStandingsRefresh: () => void;
  onGameComplete: () => void;
  gameMode?: "single" | "multi";
}

export function CardRpgGame({
  userAddress,
  availablePoints,
  initialXDR,
  initialSessionId,
  onStandingsRefresh,
  onGameComplete,
  gameMode = "single",
}: CardRpgGameProps) {
  const DEFAULT_POINTS = "0.1";
  const { getContractSigner, walletType } = useWallet();

  // Use Game Engine for multiplayer state
  const {
    sessionId: sharedSessionId,
    isHost,
    setMyAddress,
    players,
    startGame,
    resetGame,
    p1AuthEntryXDR,
    setP1AuthEntryXDR,
    myPlayer,
  } = useGameEngine();

  // Lobby Loading State
  const [isMyReady, setIsMyReady] = useState(false);
  const [gameStarted, setGameStarted] = useState(gameMode === "single");

  // Sync URL with room code for Host
  useEffect(() => {
    if (gameMode === "multi") {
      const roomCode = getRoomCode();
      const url = new URL(window.location.href);
      if (!url.searchParams.get("room") && roomCode) {
        url.searchParams.set("room", roomCode);
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [gameMode]);

  // Sync ready state
  useEffect(() => {
    if (gameMode === "multi" && myPlayer) {
      myPlayer.setState("ready", isMyReady);
      myPlayer.setState("name", userAddress); // Sync name for lobby display
      myPlayer.setState("address", userAddress); // Explicitly sync address for game logic
    }
  }, [isMyReady, myPlayer, gameMode, userAddress]);

  // Check all ready
  const allReady =
    players.length >= 2 && players.every((p: any) => p.getState("ready"));

  // Auto-start
  useEffect(() => {
    if (gameMode === "multi" && allReady) {
      setGameStarted(true);
    }
  }, [allReady, gameMode]);

  // Use local sessionId for fallback or allow shared to override
  const [localSessionId, setLocalSessionId] = useState<number>(0);

  // Effective session ID is shared if available, otherwise fallback (mostly for transitions)
  const sessionId = sharedSessionId || localSessionId;

  const setSessionId = (id: number) => {
    setLocalSessionId(id);
  };

  const [player1Address, setPlayer1Address] = useState(
    isHost ? userAddress : "",
  );
  const [player2Address, setPlayer2Address] = useState(
    !isHost ? userAddress : "",
  );

  const [player1Points, setPlayer1Points] = useState(DEFAULT_POINTS);
  const [guess, setGuess] = useState<number | null>(null);
  const [gameState, setGameState] = useState<Game | null>(null);
  const [loading, setLoading] = useState(false);
  const [quickstartLoading, setQuickstartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [gamePhase, setGamePhase] = useState<
    "create" | "guess" | "reveal" | "complete"
  >("create");
  const [createMode, setCreateMode] = useState<"create" | "import" | "load">(
    "create",
  );
  const [exportedAuthEntryXDR, setExportedAuthEntryXDR] = useState<
    string | null
  >(null);
  const [importAuthEntryXDR, setImportAuthEntryXDR] = useState("");
  const [importSessionId, setImportSessionId] = useState("");
  const [importPlayer1, setImportPlayer1] = useState("");
  const [importPlayer1Points, setImportPlayer1Points] = useState("");
  const [importPlayer2Points, setImportPlayer2Points] =
    useState(DEFAULT_POINTS);
  const [loadSessionId, setLoadSessionId] = useState("");
  const [authEntryCopied, setAuthEntryCopied] = useState(false);
  const [shareUrlCopied, setShareUrlCopied] = useState(false);
  const [xdrParsing, setXdrParsing] = useState(false);
  const [xdrParseError, setXdrParseError] = useState<string | null>(null);
  const [xdrParseSuccess, setXdrParseSuccess] = useState(false);

  // Sync user address to Playroom
  useEffect(() => {
    if (userAddress) {
      setMyAddress(userAddress);
    }
  }, [userAddress, setMyAddress]);

  // Sync players from Playroom
  useEffect(() => {
    // players is an array of Playroom player states
    // We iterate to find P1 and P2 based on who is host
    // Assumption: Host is Player 1
    const p1 = players.find((p) => p.id === players[0]?.id); // Simplistic: first player is host?
    // Actually Playroom doesn't guarantee order, but host usually joins first or we check p.isHost?
    // Let's use isHost logic locally first.

    // Better logic:
    // If I am Host, I am P1. My address is P1 address. The other player is P2.
    // If I am Guest, I am P2. My address is P2 address. The other player is P1.

    // However, we need the *addresses* of the other players.
    // players[i].getState('address')

    // Let's iterate all players
    let p1Addr = "";
    let p2Addr = "";

    // We need to know which playroom player is P1.
    // In Playroom, we can verify if a player object corresponds to "me".
    const sortedPlayers = [...players].sort((a, b) => a.id.localeCompare(b.id));

    // Determine if I am P1 or P2 to enforce local truth (Wallet Address) over potentially stale Playroom state
    const myIndex = sortedPlayers.findIndex((p) => p.id === myPlayer?.id);

    if (sortedPlayers.length > 0) {
      if (myIndex === 0 && userAddress) {
        // I am Player 1, use my wallet address directly
        p1Addr = userAddress;
      } else {
        p1Addr =
          sortedPlayers[0].getState("address") ||
          sortedPlayers[0].getState("name") ||
          "";
      }
    }

    if (sortedPlayers.length > 1) {
      if (myIndex === 1 && userAddress) {
        // I am Player 2, use my wallet address directly
        p2Addr = userAddress;
      } else {
        p2Addr =
          sortedPlayers[1].getState("address") ||
          sortedPlayers[1].getState("name") ||
          "";
      }
    }

    // Only update if we have found valid players, otherwise keep existing state (handling single player fallback)
    if (players.length > 0) {
      setPlayer1Address(p1Addr);
      setPlayer2Address(p2Addr);
    }
  }, [players, userAddress, myPlayer]);

  // Playroom: Auto-import auth entry for Guest
  useEffect(() => {
    if (!isHost && p1AuthEntryXDR && gamePhase === "create") {
      console.log(
        "Received P1 Auth Entry from Playroom, switching to import mode",
      );
      setImportAuthEntryXDR(p1AuthEntryXDR);
      setCreateMode("import");
    }
  }, [isHost, p1AuthEntryXDR, gamePhase]);

  useEffect(() => {
    if (createMode === "import" && !importPlayer2Points.trim()) {
      setImportPlayer2Points(DEFAULT_POINTS);
    }
  }, [createMode, importPlayer2Points]);

  // Handle reset/new game triggered by Host (Multiplayer Sync)
  const prevSessionIdRef = useRef(sessionId);
  useEffect(() => {
    // Check if session ID changed
    if (gameMode === "multi" && sessionId !== prevSessionIdRef.current) {
      console.log(
        `[Multiplayer] Session ID changed: ${prevSessionIdRef.current} -> ${sessionId}. Resetting game state.`,
      );

      // Reset to "create" phase (Setup Screen)
      setGamePhase("create");
      setGameState(null);
      setGuess(null);
      setError(null);
      setSuccess(null);

      // Reset Setup Form
      setCreateMode("create");
      setExportedAuthEntryXDR(null);
      setImportAuthEntryXDR("");
      setImportSessionId("");
      setImportPlayer1("");
      setImportPlayer1Points("");
      setImportPlayer2Points(DEFAULT_POINTS);
      setLoadSessionId("");

      // Reset other UI states
      setAuthEntryCopied(false);
      setShareUrlCopied(false);
      setXdrParsing(false);
      setXdrParseError(null);
      setXdrParseSuccess(false);

      prevSessionIdRef.current = sessionId;
    }
  }, [sessionId, gameMode]);

  const POINTS_DECIMALS = 7;
  const isBusy = loading || quickstartLoading;
  const actionLock = useRef(false);
  const quickstartAvailable =
    walletType === "dev" &&
    DevWalletService.isDevModeAvailable() &&
    DevWalletService.isPlayerAvailable(1) &&
    DevWalletService.isPlayerAvailable(2);

  const runAction = async (action: () => Promise<void>) => {
    if (actionLock.current || isBusy) {
      return;
    }
    actionLock.current = true;
    try {
      await action();
    } finally {
      actionLock.current = false;
    }
  };

  const handleStartNewGame = () => {
    if (gameState?.winner) {
      onGameComplete();
    }

    actionLock.current = false;
    setGamePhase("create");
    // Trigger reset for both players
    resetGame();
    // (Guest might not trigger new ID generation locally but will see sessionId -> 0 -> wait for Host)
    if (isHost) {
      // Host will see 0 and trigger startGame() via useEffect or we can do it here explicitly
      startGame();
    }

    setGameState(null);
    setGuess(null);
    setLoading(false);
    setQuickstartLoading(false);
    setError(null);
    setSuccess(null);
    setCreateMode("create");
    setExportedAuthEntryXDR(null);
    setImportAuthEntryXDR("");
    setImportSessionId("");
    setImportPlayer1("");
    setImportPlayer1Points("");
    setImportPlayer2Points(DEFAULT_POINTS);
    setLoadSessionId("");
    setAuthEntryCopied(false);
    setShareUrlCopied(false);
    setXdrParsing(false);
    setXdrParseError(null);
    setXdrParseSuccess(false);
    setPlayer1Address(userAddress);
    setPlayer1Points(DEFAULT_POINTS);
  };

  const parsePoints = (value: string): bigint | null => {
    try {
      const cleaned = value.replace(/[^\d.]/g, "");
      if (!cleaned || cleaned === ".") return null;

      const [whole = "0", fraction = ""] = cleaned.split(".");
      const paddedFraction = fraction
        .padEnd(POINTS_DECIMALS, "0")
        .slice(0, POINTS_DECIMALS);
      return BigInt(whole + paddedFraction);
    } catch {
      return null;
    }
  };

  const handleMultiplayerReady = async () => {
    setIsMyReady(!isMyReady);
  };

  const loadGameState = async () => {
    try {
      // Always fetch latest game state to avoid stale cached results after transactions.
      console.log(`[loadGameState] Fetching game ${sessionId}...`);
      const game = await cardRpgService.getGame(sessionId);
      console.log(`[loadGameState] Result:`, game);
      setGameState(game);

      // Determine game phase based on state
      if (game && game.winner !== null && game.winner !== undefined) {
        console.log(
          `[loadGameState] Winner detected: ${game.winner} -> Complete`,
        );
        setGamePhase("complete");
      } else if (
        game &&
        game.player1_guess !== null &&
        game.player1_guess !== undefined &&
        game.player2_guess !== null &&
        game.player2_guess !== undefined
      ) {
        console.log(`[loadGameState] Both guessed -> Reveal`);
        setGamePhase("reveal");
      } else {
        console.log(`[loadGameState] No winner, incomplete guesses -> Guess`);
        setGamePhase("guess");
      }
    } catch (err) {
      // Game doesn't exist yet
      setGameState(null);
    }
  };

  useEffect(() => {
    if (gamePhase !== "create") {
      loadGameState();
      const interval = setInterval(loadGameState, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [sessionId, gamePhase]);

  // Auto-refresh standings when game completes (for passive player who didn't call reveal_winner)
  useEffect(() => {
    if (gamePhase === "complete" && gameState?.winner) {
      console.log("Game completed! Refreshing standings and dashboard data...");
      onStandingsRefresh(); // Refresh standings and available points; don't call onGameComplete() here or it will close the game!
    }
  }, [gamePhase, gameState?.winner]);

  // Handle initial values from URL deep linking or props
  // Expected URL formats:
  //   - With auth entry: ?game=card-rpg&auth=AAAA... (Session ID, P1 address, P1 points parsed from auth entry)
  //   - With session ID: ?game=card-rpg&session-id=123 (Load existing game)
  // Note: GamesCatalog cleans URL params, so we prioritize props over URL
  useEffect(() => {
    // Priority 1: Check initialXDR prop (from GamesCatalog after URL cleanup)
    if (initialXDR) {
      console.log("[Deep Link] Using initialXDR prop from GamesCatalog");

      try {
        const parsed = cardRpgService.parseAuthEntry(initialXDR);
        const sessionId = parsed.sessionId;

        console.log(
          "[Deep Link] Parsed session ID from initialXDR:",
          sessionId,
        );

        // Check if game already exists (both players have signed)
        cardRpgService
          .getGame(sessionId)
          .then((game) => {
            if (game) {
              // Game exists! Load it directly instead of going to import mode
              console.log(
                "[Deep Link] Game already exists, loading directly to guess phase",
              );
              console.log("[Deep Link] Game data:", game);

              // Auto-load the game - bypass create phase entirely
              setGameState(game);
              setGamePhase("guess");
              setSessionId(sessionId); // Set session ID for the game
            } else {
              // Game doesn't exist yet, go to import mode
              console.log("[Deep Link] Game not found, entering import mode");
              setCreateMode("import");
              setImportAuthEntryXDR(initialXDR);
              setImportSessionId(sessionId.toString());
              setImportPlayer1(parsed.player1);
              setImportPlayer1Points(
                (Number(parsed.player1Points) / 10_000_000).toString(),
              );
              setImportPlayer2Points("0.1");
            }
          })
          .catch((err) => {
            console.error("[Deep Link] Error checking game existence:", err);
            console.error("[Deep Link] Error details:", {
              message: err?.message,
              stack: err?.stack,
              sessionId: sessionId,
            });
            // If we can't check, default to import mode
            setCreateMode("import");
            setImportAuthEntryXDR(initialXDR);
            setImportSessionId(parsed.sessionId.toString());
            setImportPlayer1(parsed.player1);
            setImportPlayer1Points(
              (Number(parsed.player1Points) / 10_000_000).toString(),
            );
            setImportPlayer2Points("0.1");
          });
      } catch (err) {
        console.log(
          "[Deep Link] Failed to parse initialXDR, will retry on import",
        );
        setCreateMode("import");
        setImportAuthEntryXDR(initialXDR);
        setImportPlayer2Points("0.1");
      }
      return; // Exit early - we processed initialXDR
    }

    // Priority 2: Check URL parameters (for direct navigation without GamesCatalog)
    const urlParams = new URLSearchParams(window.location.search);
    const authEntry = urlParams.get("auth");
    const urlSessionId = urlParams.get("session-id");

    if (authEntry) {
      // Simplified URL format - only auth entry is needed
      // Session ID, Player 1 address, and points are parsed from auth entry
      console.log("[Deep Link] Auto-populating game from URL with auth entry");

      // Try to parse auth entry to get session ID
      try {
        const parsed = cardRpgService.parseAuthEntry(authEntry);
        const sessionId = parsed.sessionId;

        console.log(
          "[Deep Link] Parsed session ID from URL auth entry:",
          sessionId,
        );

        // Check if game already exists (both players have signed)
        cardRpgService
          .getGame(sessionId)
          .then((game) => {
            if (game) {
              // Game exists! Load it directly instead of going to import mode
              console.log(
                "[Deep Link] Game already exists (URL), loading directly to guess phase",
              );
              console.log("[Deep Link] Game data:", game);

              // Auto-load the game - bypass create phase entirely
              setGameState(game);
              setGamePhase("guess");
              setSessionId(sessionId); // Set session ID for the game
            } else {
              // Game doesn't exist yet, go to import mode
              console.log(
                "[Deep Link] Game not found (URL), entering import mode",
              );
              setCreateMode("import");
              setImportAuthEntryXDR(authEntry);
              setImportSessionId(sessionId.toString());
              setImportPlayer1(parsed.player1);
              setImportPlayer1Points(
                (Number(parsed.player1Points) / 10_000_000).toString(),
              );
              setImportPlayer2Points("0.1");
            }
          })
          .catch((err) => {
            console.error(
              "[Deep Link] Error checking game existence (URL):",
              err,
            );
            console.error("[Deep Link] Error details:", {
              message: err?.message,
              stack: err?.stack,
              sessionId: sessionId,
            });
            // If we can't check, default to import mode
            setCreateMode("import");
            setImportAuthEntryXDR(authEntry);
            setImportSessionId(parsed.sessionId.toString());
            setImportPlayer1(parsed.player1);
            setImportPlayer1Points(
              (Number(parsed.player1Points) / 10_000_000).toString(),
            );
            setImportPlayer2Points("0.1");
          });
      } catch (err) {
        console.log(
          "[Deep Link] Failed to parse auth entry from URL, will retry on import",
        );
        setCreateMode("import");
        setImportAuthEntryXDR(authEntry);
        setImportPlayer2Points("0.1");
      }
    } else if (urlSessionId) {
      // Load existing game by session ID
      console.log("[Deep Link] Auto-populating game from URL with session ID");
      setCreateMode("load");
      setLoadSessionId(urlSessionId);
    } else if (initialSessionId !== null && initialSessionId !== undefined) {
      console.log(
        "[Deep Link] Auto-populating session ID from prop:",
        initialSessionId,
      );
      setCreateMode("load");
      setLoadSessionId(initialSessionId.toString());
    }
  }, [initialXDR, initialSessionId]);

  // Auto-parse Auth Entry XDR when pasted
  useEffect(() => {
    // Only parse if in import mode and XDR is not empty
    if (createMode !== "import" || !importAuthEntryXDR.trim()) {
      // Reset parse states when XDR is cleared
      if (!importAuthEntryXDR.trim()) {
        setXdrParsing(false);
        setXdrParseError(null);
        setXdrParseSuccess(false);
        setImportSessionId("");
        setImportPlayer1("");
        setImportPlayer1Points("");
      }
      return;
    }

    // Auto-parse the XDR
    const parseXDR = async () => {
      setXdrParsing(true);
      setXdrParseError(null);
      setXdrParseSuccess(false);

      try {
        console.log("[Auto-Parse] Parsing auth entry XDR...");
        const gameParams = cardRpgService.parseAuthEntry(
          importAuthEntryXDR.trim(),
        );

        // Check if user is trying to import their own auth entry (self-play prevention)
        if (gameParams.player1 === userAddress) {
          throw new Error(
            "Self-Play Error: You are still logged in as Player 1. Please switch your Freighter wallet to a different account and refresh the page to join as Player 2.",
          );
        }

        // Successfully parsed - auto-fill fields
        setImportSessionId(gameParams.sessionId.toString());
        setImportPlayer1(gameParams.player1);
        setImportPlayer1Points(
          (Number(gameParams.player1Points) / 10_000_000).toString(),
        );
        setXdrParseSuccess(true);
        console.log("[Auto-Parse] Successfully parsed auth entry:", {
          sessionId: gameParams.sessionId,
          player1: gameParams.player1,
          player1Points: (
            Number(gameParams.player1Points) / 10_000_000
          ).toString(),
        });
      } catch (err) {
        console.error("[Auto-Parse] Failed to parse auth entry:", err);
        const errorMsg =
          err instanceof Error ? err.message : "Invalid auth entry XDR";
        setXdrParseError(errorMsg);
        // Clear auto-filled fields on error
        setImportSessionId("");
        setImportPlayer1("");
        setImportPlayer1Points("");
      } finally {
        setXdrParsing(false);
      }
    };

    // Debounce parsing to avoid parsing on every keystroke
    const timeoutId = setTimeout(parseXDR, 500);
    return () => clearTimeout(timeoutId);
  }, [importAuthEntryXDR, createMode, userAddress]);

  const handlePrepareTransaction = async () => {
    await runAction(async () => {
      try {
        setLoading(true);
        setError(null);
        setSuccess(null);

        const p1Points = parsePoints(player1Points);

        if (!p1Points || p1Points <= 0n) {
          throw new Error("Enter a valid points amount");
        }

        const signer = getContractSigner();

        // Use placeholder values for Player 2 (they'll rebuild with their own values).
        // We still need a real, funded account as the transaction source for build/simulation.
        const placeholderPlayer2Address =
          await getFundedSimulationSourceAddress([player1Address, userAddress]);
        const placeholderP2Points = p1Points; // Same as P1 for simulation

        console.log("Preparing transaction for Player 1 to sign...");
        console.log("Using placeholder Player 2 values for simulation only");
        const authEntryXDR = await cardRpgService.prepareStartGame(
          sessionId,
          player1Address,
          placeholderPlayer2Address,
          p1Points,
          placeholderP2Points,
          signer,
        );

        console.log(
          "Transaction prepared successfully! Player 1 has signed their auth entry.",
        );
        setExportedAuthEntryXDR(authEntryXDR);
        // Share via Playroom
        if (setP1AuthEntryXDR) {
          setP1AuthEntryXDR(authEntryXDR);
        }
        setSuccess(
          "Auth entry signed! Shared via Playroom. Waiting for Player 2 to sign...",
        );

        // Start polling for the game to be created by Player 2
        const pollInterval = setInterval(async () => {
          try {
            // Try to load the game
            const game = await cardRpgService.getGame(sessionId);
            if (game) {
              console.log(
                "Game found! Player 2 has finalized the transaction. Transitioning to guess phase...",
              );
              clearInterval(pollInterval);

              // Update game state
              setGameState(game);
              setExportedAuthEntryXDR(null);
              setSuccess("Game created! Player 2 has signed and submitted.");
              setGamePhase("guess");

              // Refresh dashboard to show updated available points (locked in game)
              onStandingsRefresh();

              // Clear success message after 2 seconds
              setTimeout(() => setSuccess(null), 2000);
            } else {
              console.log("Game not found yet, continuing to poll...");
            }
          } catch (err) {
            // Game doesn't exist yet, keep polling
            console.log(
              "Polling for game creation...",
              err instanceof Error ? err.message : "checking",
            );
          }
        }, 3000); // Poll every 3 seconds

        // Stop polling after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          console.log("Stopped polling after 5 minutes");
        }, 300000);
      } catch (err) {
        console.error("Prepare transaction error details:", err);
        // Extract detailed error message
        let errorMessage = "Failed to prepare transaction";
        if (err instanceof Error) {
          errorMessage = err.message;

          // Check for common errors
          if (err.message.includes("insufficient")) {
            errorMessage = `Insufficient points: ${err.message}. Make sure you have enough points for this game.`;
          } else if (
            err.message.includes("Authorization failed") ||
            err.message.includes("User declined")
          ) {
            // Clean up nested error messages
            errorMessage = err.message
              .replace(/Authorization failed: /g, "")
              .trim();
            if (!errorMessage)
              errorMessage =
                "Authorization failed. Check your wallet connection.";
          }
        }

        setError(errorMessage);
        toast.error(errorMessage);

        // Keep the component in 'create' phase so user can see the error and retry
      } finally {
        setLoading(false);
      }
    });
  };

  const handleQuickStart = async () => {
    await runAction(async () => {
      try {
        setQuickstartLoading(true);
        setError(null);
        setSuccess(null);
        if (walletType !== "dev") {
          throw new Error(
            "Quickstart only works with dev wallets in the Games Library.",
          );
        }

        if (
          !DevWalletService.isDevModeAvailable() ||
          !DevWalletService.isPlayerAvailable(1) ||
          !DevWalletService.isPlayerAvailable(2)
        ) {
          throw new Error(
            'Quickstart requires both dev wallets. Run "bun run setup" and connect a dev wallet.',
          );
        }

        const p1Points = parsePoints(player1Points);
        if (!p1Points || p1Points <= 0n) {
          throw new Error("Enter a valid points amount");
        }

        const originalPlayer = devWalletService.getCurrentPlayer();
        let player1AddressQuickstart = "";
        let player2AddressQuickstart = "";
        let player1Signer: ReturnType<
          typeof devWalletService.getSigner
        > | null = null;
        let player2Signer: ReturnType<
          typeof devWalletService.getSigner
        > | null = null;

        try {
          await devWalletService.initPlayer(1);
          player1AddressQuickstart = devWalletService.getPublicKey();
          player1Signer = devWalletService.getSigner();

          await devWalletService.initPlayer(2);
          player2AddressQuickstart = devWalletService.getPublicKey();
          player2Signer = devWalletService.getSigner();
        } finally {
          if (originalPlayer) {
            await devWalletService.initPlayer(originalPlayer);
          }
        }

        if (!player1Signer || !player2Signer) {
          throw new Error(
            "Quickstart failed to initialize dev wallet signers.",
          );
        }

        if (player1AddressQuickstart === player2AddressQuickstart) {
          throw new Error("Quickstart requires two different dev wallets.");
        }

        const quickstartSessionId = createRandomSessionId();
        setSessionId(quickstartSessionId);
        setPlayer1Address(player1AddressQuickstart);
        setCreateMode("create");
        setExportedAuthEntryXDR(null);
        setImportAuthEntryXDR("");
        setImportSessionId("");
        setImportPlayer1("");
        setImportPlayer1Points("");
        setImportPlayer2Points(DEFAULT_POINTS);
        setLoadSessionId("");

        const placeholderPlayer2Address =
          await getFundedSimulationSourceAddress([
            player1AddressQuickstart,
            player2AddressQuickstart,
          ]);

        const authEntryXDR = await cardRpgService.prepareStartGame(
          quickstartSessionId,
          player1AddressQuickstart,
          placeholderPlayer2Address,
          p1Points,
          p1Points,
          player1Signer,
        );

        const fullySignedTxXDR = await cardRpgService.importAndSignAuthEntry(
          authEntryXDR,
          player2AddressQuickstart,
          p1Points,
          player2Signer,
        );

        await cardRpgService.finalizeStartGame(
          fullySignedTxXDR,
          player2AddressQuickstart,
          player2Signer,
        );

        try {
          const game = await cardRpgService.getGame(quickstartSessionId);
          setGameState(game);
        } catch (err) {
          console.log("Quickstart game not available yet:", err);
        }
        setGamePhase("guess");
        onStandingsRefresh();
        setSuccess(
          "Quickstart complete! Both players signed and the game is ready.",
        );
        toast.success("Quickstart complete!");
        setTimeout(() => setSuccess(null), 2000);
      } catch (err) {
        console.error("Quickstart error:", err);
        const msg = err instanceof Error ? err.message : "Quickstart failed";
        setError(msg);
        toast.error(msg);
      } finally {
        setQuickstartLoading(false);
      }
    });
  };

  const handleImportTransaction = async () => {
    await runAction(async () => {
      try {
        setLoading(true);
        setError(null);
        setSuccess(null);
        // Validate required inputs (only auth entry and player 2 points)
        if (!importAuthEntryXDR.trim()) {
          throw new Error("Enter auth entry XDR from Player 1");
        }
        if (!importPlayer2Points.trim()) {
          throw new Error("Enter your points amount (Player 2)");
        }

        // Parse Player 2's points
        const p2Points = parsePoints(importPlayer2Points);
        if (!p2Points || p2Points <= 0n) {
          throw new Error("Invalid Player 2 points");
        }

        // Parse auth entry to extract game parameters
        // The auth entry contains: session_id, player1, player1_points
        console.log("Parsing auth entry to extract game parameters...");
        const gameParams = cardRpgService.parseAuthEntry(
          importAuthEntryXDR.trim(),
        );

        console.log("Extracted from auth entry:", {
          sessionId: gameParams.sessionId,
          player1: gameParams.player1,
          player1Points: gameParams.player1Points.toString(),
        });

        // Auto-populate read-only fields from parsed auth entry (for display)
        setImportSessionId(gameParams.sessionId.toString());
        setImportPlayer1(gameParams.player1);
        setImportPlayer1Points(
          (Number(gameParams.player1Points) / 10_000_000).toString(),
        );

        // Verify the user is Player 2 (prevent self-play)
        if (gameParams.player1 === userAddress) {
          throw new Error(
            "Invalid game: You cannot play against yourself (you are Player 1 in this auth entry)",
          );
        }

        // Additional validation: Ensure Player 2 address is different from Player 1
        // (In case user manually edits the Player 2 field)
        if (userAddress === gameParams.player1) {
          throw new Error(
            "Cannot play against yourself. Player 2 must be different from Player 1.",
          );
        }

        const signer = getContractSigner();

        // Step 1: Import Player 1's signed auth entry and rebuild transaction
        // New simplified API - only needs: auth entry, player 2 address, player 2 points
        console.log(
          "Importing Player 1 auth entry and rebuilding transaction...",
        );
        const fullySignedTxXDR = await cardRpgService.importAndSignAuthEntry(
          importAuthEntryXDR.trim(),
          userAddress, // Player 2 address (current user)
          p2Points,
          signer,
        );

        // Step 2: Player 2 finalizes and submits (they are the transaction source)
        console.log("Simulating and submitting transaction...");
        await cardRpgService.finalizeStartGame(
          fullySignedTxXDR,
          userAddress,
          signer,
        );

        // If we get here, transaction succeeded! Now update state.
        console.log("Transaction submitted successfully! Updating state...");
        setSessionId(gameParams.sessionId);
        setSuccess("Game created successfully! Both players signed.");
        setGamePhase("guess");

        // Clear import fields
        setImportAuthEntryXDR("");
        setImportSessionId("");
        setImportPlayer1("");
        setImportPlayer1Points("");
        setImportPlayer2Points(DEFAULT_POINTS);

        // Load the newly created game state
        await loadGameState();

        // Refresh dashboard to show updated available points (locked in game)
        onStandingsRefresh();

        // Clear success message after 2 seconds
        setTimeout(() => setSuccess(null), 2000);
      } catch (err) {
        console.error("Import transaction error:", err);
        // Extract detailed error message if available
        let errorMessage = "Failed to import and sign transaction";
        if (err instanceof Error) {
          errorMessage = err.message;

          // Check for common Soroban errors
          if (err.message.includes("simulation failed")) {
            errorMessage = `Simulation failed: ${err.message}. Check that you have enough Points and the game parameters are correct.`;
          } else if (err.message.includes("transaction failed")) {
            errorMessage = `Transaction failed: ${err.message}. The game could not be created on the blockchain.`;
          }
        }

        setError(errorMessage);
        toast.error(errorMessage);

        // Keep the component in 'create' phase so user can see the error and retry
        // Don't change gamePhase or clear any fields - let the user see what went wrong
      } finally {
        setLoading(false);
      }
    });
  };

  const handleLoadExistingGame = async () => {
    await runAction(async () => {
      try {
        setLoading(true);
        setError(null);
        setSuccess(null);
        const parsedSessionId = parseInt(loadSessionId.trim());
        if (isNaN(parsedSessionId) || parsedSessionId <= 0) {
          throw new Error("Enter a valid session ID");
        }

        // Try to load the game (use cache to prevent duplicate calls)
        const game = await requestCache.dedupe(
          createCacheKey("game-state", parsedSessionId),
          () => cardRpgService.getGame(parsedSessionId),
          5000,
        );

        // Verify game exists and user is one of the players
        if (!game) {
          throw new Error("Game not found");
        }

        if (game.player1 !== userAddress && game.player2 !== userAddress) {
          throw new Error("You are not a player in this game");
        }

        // Load successful - update session ID and transition to game
        setSessionId(parsedSessionId);
        setGameState(game);
        setLoadSessionId("");

        // Determine game phase based on game state
        if (game.winner !== null && game.winner !== undefined) {
          // Game is complete - show reveal phase with winner
          setGamePhase("reveal");
          const isWinner = game.winner === userAddress;
          setSuccess(
            isWinner
              ? "🎉 You won this game!"
              : "Game complete. Winner revealed.",
          );
        } else if (
          game.player1_guess !== null &&
          game.player1_guess !== undefined &&
          game.player2_guess !== null &&
          game.player2_guess !== undefined
        ) {
          // Both players guessed, waiting for reveal
          setGamePhase("reveal");
          setSuccess(
            "Game loaded! Both players have guessed. You can reveal the winner.",
          );
        } else {
          // Still in guessing phase
          setGamePhase("guess");
          setSuccess("Game loaded! Make your guess.");
        }

        // Clear success message after 2 seconds
        setTimeout(() => setSuccess(null), 2000);
      } catch (err) {
        console.error("Load game error:", err);
        setError(err instanceof Error ? err.message : "Failed to load game");
      } finally {
        setLoading(false);
      }
    });
  };

  const copyAuthEntryToClipboard = async () => {
    if (exportedAuthEntryXDR) {
      try {
        await navigator.clipboard.writeText(exportedAuthEntryXDR);
        setAuthEntryCopied(true);
        setTimeout(() => setAuthEntryCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy auth entry XDR:", err);
        setError("Failed to copy to clipboard");
      }
    }
  };

  const copyShareGameUrlWithAuthEntry = async () => {
    if (exportedAuthEntryXDR) {
      try {
        // Build URL with only Player 1's info and auth entry
        // Player 2 will specify their own points when they import
        const params = new URLSearchParams({
          game: "card-rpg",
          auth: exportedAuthEntryXDR,
        });

        const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
        await navigator.clipboard.writeText(shareUrl);
        setShareUrlCopied(true);
        setTimeout(() => setShareUrlCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy share URL:", err);
        setError("Failed to copy to clipboard");
      }
    }
  };

  const copyShareGameUrlWithSessionId = async () => {
    if (loadSessionId) {
      try {
        const shareUrl = `${window.location.origin}${window.location.pathname}?game=card-rpg&session-id=${loadSessionId}`;
        await navigator.clipboard.writeText(shareUrl);
        setShareUrlCopied(true);
        setTimeout(() => setShareUrlCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy share URL:", err);
        setError("Failed to copy to clipboard");
      }
    }
  };

  const handleMakeGuess = async () => {
    if (guess === null) {
      setError("Select a number to guess");
      return;
    }

    await runAction(async () => {
      try {
        setLoading(true);
        setError(null);
        setSuccess(null);

        const signer = getContractSigner();
        await cardRpgService.makeGuess(sessionId, userAddress, guess, signer);

        setSuccess(`Guess submitted: ${guess}`);
        toast.success(`Guess submitted: ${guess}`);
        await loadGameState();
      } catch (err) {
        console.error("Make guess error:", err);
        const msg = err instanceof Error ? err.message : "Failed to make guess";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    });
  };

  const waitForWinner = async () => {
    let updatedGame = await cardRpgService.getGame(sessionId);
    let attempts = 0;
    while (
      attempts < 5 &&
      (!updatedGame ||
        updatedGame.winner === null ||
        updatedGame.winner === undefined)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      updatedGame = await cardRpgService.getGame(sessionId);
      attempts += 1;
    }
    return updatedGame;
  };

  const handleRevealWinner = async () => {
    await runAction(async () => {
      try {
        setLoading(true);
        setError(null);
        setSuccess(null);

        const signer = getContractSigner();
        await cardRpgService.revealWinner(sessionId, userAddress, signer);

        // Fetch updated on-chain state and derive the winner from it (avoid type mismatches from tx result decoding).
        const updatedGame = await waitForWinner();
        setGameState(updatedGame);
        setGamePhase("complete");

        const isWinner = updatedGame?.winner === userAddress;
        setSuccess(
          isWinner ? "🎉 You won!" : "Game complete! Winner revealed.",
        );
        toast.success(isWinner ? "You won!" : "Winner revealed.");

        // Refresh standings immediately (without navigating away)
        onStandingsRefresh();

        // DON'T call onGameComplete() immediately - let user see the results
        // User can click "Start New Game" when ready
      } catch (err) {
        console.error("Reveal winner error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to reveal winner",
        );
      } finally {
        setLoading(false);
      }
    });
  };

  const isPlayer1 = gameState && gameState.player1 === userAddress;
  const isPlayer2 = gameState && gameState.player2 === userAddress;
  const hasGuessed = isPlayer1
    ? gameState?.player1_guess !== null &&
      gameState?.player1_guess !== undefined
    : isPlayer2
      ? gameState?.player2_guess !== null &&
        gameState?.player2_guess !== undefined
      : false;

  const winningNumber = gameState?.winning_number;
  const player1Guess = gameState?.player1_guess;
  const player2Guess = gameState?.player2_guess;
  const player1Distance =
    winningNumber !== null &&
    winningNumber !== undefined &&
    player1Guess !== null &&
    player1Guess !== undefined
      ? Math.abs(Number(player1Guess) - Number(winningNumber))
      : null;
  const player2Distance =
    winningNumber !== null &&
    winningNumber !== undefined &&
    player2Guess !== null &&
    player2Guess !== undefined
      ? Math.abs(Number(player2Guess) - Number(winningNumber))
      : null;

  if (gameMode === "multi" && !gameStarted) {
    return (
      <MultiplayerLobby
        gameMode={gameMode}
        gameStarted={gameStarted}
        players={players}
        myPlayer={myPlayer}
        isMyReady={isMyReady}
        allReady={allReady}
        handleMultiplayerReady={handleMultiplayerReady}
      />
    );
  }

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-8 shadow-xl border-2 border-purple-200">
      <Toaster position="bottom-right" /> {/* Move Toaster inside Game */}
      <GameHeader
        gameMode={gameMode}
        players={players}
        myPlayer={myPlayer}
        sessionId={sessionId}
      />
      {error && (
        <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-xl">
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
          <p className="text-sm font-semibold text-green-700">{success}</p>
        </div>
      )}
      <SetupScreen
        gamePhase={gamePhase}
        createMode={createMode}
        setCreateMode={setCreateMode}
        gameMode={gameMode!}
        isHost={isHost}
        userAddress={userAddress}
        sessionId={sessionId}
        availablePoints={availablePoints}
        player1Address={player1Address}
        setPlayer1Address={setPlayer1Address}
        player1Points={player1Points}
        setPlayer1Points={setPlayer1Points}
        importAuthEntryXDR={importAuthEntryXDR}
        setImportAuthEntryXDR={setImportAuthEntryXDR}
        importSessionId={importSessionId}
        importPlayer1={importPlayer1}
        importPlayer1Points={importPlayer1Points}
        importPlayer2Points={importPlayer2Points}
        setImportPlayer2Points={setImportPlayer2Points}
        loadSessionId={loadSessionId}
        setLoadSessionId={setLoadSessionId}
        exportedAuthEntryXDR={exportedAuthEntryXDR}
        setExportedAuthEntryXDR={setExportedAuthEntryXDR}
        setImportSessionId={setImportSessionId}
        setImportPlayer1={setImportPlayer1}
        setImportPlayer1Points={setImportPlayer1Points}
        setImportAuthEntryXDRState={setImportAuthEntryXDR}
        xdrParsing={xdrParsing}
        xdrParseSuccess={xdrParseSuccess}
        xdrParseError={xdrParseError}
        loading={loading}
        isBusy={isBusy}
        quickstartLoading={quickstartLoading}
        quickstartAvailable={quickstartAvailable}
        authEntryCopied={authEntryCopied}
        shareUrlCopied={shareUrlCopied}
        handlePrepareTransaction={handlePrepareTransaction}
        handleImportTransaction={handleImportTransaction}
        handleLoadExistingGame={handleLoadExistingGame}
        handleQuickStart={handleQuickStart}
        copyAuthEntryToClipboard={copyAuthEntryToClipboard}
        copyShareGameUrlWithAuthEntry={copyShareGameUrlWithAuthEntry}
        copyShareGameUrlWithSessionId={copyShareGameUrlWithSessionId}
        DEFAULT_POINTS={DEFAULT_POINTS}
      />
      <ActiveGame
        gamePhase={gamePhase}
        gameState={gameState}
        userAddress={userAddress}
        guess={guess}
        setGuess={setGuess}
        loading={loading}
        isBusy={isBusy}
        handleMakeGuess={handleMakeGuess}
        handleRevealWinner={handleRevealWinner}
        handleStartNewGame={handleStartNewGame}
      />

    </div>
  );
}
