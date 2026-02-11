import { useState, useEffect } from "react";
import { insertCoin, isStreamScreen } from "playroomkit";
import { config } from "./config";
import { Layout } from "./components/Layout";
import { useWallet } from "./hooks/useWallet";
import { GameEngineProvider } from "./hooks/useGameEngine";
import { CardRpgGame } from "./games/card-rpg/CardRpgGame";
import { SplashScreen } from "./components/SplashScreen";
import { ModeSelectScreen } from "./components/ModeSelectScreen";
import { SettingsScreen } from "./components/SettingsScreen";

const GAME_ID = "card-rpg";
const GAME_TITLE = import.meta.env.VITE_GAME_TITLE || "Card Rpg";
const GAME_TAGLINE =
  import.meta.env.VITE_GAME_TAGLINE || "On-chain game on Stellar";

export default function App() {
  const {
    publicKey,
    isConnected,
    isConnecting,
    error,
    isDevModeAvailable,
    connect,
  } = useWallet();
  const userAddress = publicKey ?? "";
  const contractId = config.contractIds[GAME_ID] || "";
  const hasContract = contractId && contractId !== "YOUR_CONTRACT_ID";
  // We can relax devReady check if we allow real wallets, but for now lets keep checking contract config
  const devReady = isDevModeAvailable(); // Keep this check or remove? User wants "end user connect their wallet"
  // If we require dev wallets to be present even for real users, that's weird.
  // But the existing code has rigorous checks. Let's relax them slightly or maybe not.
  // The user said "make the user end user connect therri wallet... login screem to accept user reqquest".
  // So probably we should support real wallets primarily.

  const [gameMode, setGameMode] = useState<"single" | "multi" | null>(null);
  const [playroomLoading, setPlayroomLoading] = useState(false);
  const [initRoomCode, setInitRoomCode] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Initial auto-join state based on URL
  const [isAutoJoining, setIsAutoJoining] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return !!(params.get("room") || params.get("r"));
  });

  // Check for room code in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get("room") || params.get("r");
    if (roomCode) {
      setInitRoomCode(roomCode);
    }
  }, []);

  const handleStartGame = async (
    mode: "single" | "multi",
    roomCode?: string,
  ) => {
    setPlayroomLoading(true);
    try {
      // Initialize Playroom skipping the built-in lobby for both modes
      // The user wants to avoid the "bot or friend" selection screen
      await insertCoin({
        streamMode: false,
        skipLobby: true,
        roomCode: roomCode || undefined, // Join specific room if code provided
      });

      // If we wanted to set the profile based on the wallet:
      // const profile = ...
      // myPlayer().setState("profile", profile);

      setGameMode(mode);
    } catch (e) {
      console.error("Failed to start game:", e);
    } finally {
      setPlayroomLoading(false);
      setIsAutoJoining(false);
    }
  };

  const handleConnect = async () => {
    // Connect user wallet (Freighter, etc)
    if (connect) {
      await connect();
    }
  };

  // Auto-join if room code exists and wallet is ready
  useEffect(() => {
    if (
      initRoomCode &&
      isConnected &&
      !gameMode &&
      !playroomLoading &&
      !isConnecting
    ) {
      console.log("Auto-joining game with room:", initRoomCode);
      handleStartGame("multi", initRoomCode);
    }
  }, [initRoomCode, isConnected, gameMode, playroomLoading, isConnecting]);

  return (
    <Layout title={GAME_TITLE} subtitle={GAME_TAGLINE}>
      {!hasContract ? (
        <div className="card">
          <h3 className="gradient-text">Contract Not Configured</h3>
          <p style={{ color: "var(--color-ink-muted)", marginTop: "1rem" }}>
            Run <code>bun run setup</code> to deploy and configure testnet
            contract IDs, or set
            <code>VITE_CARD_RPG_CONTRACT_ID</code> in the root <code>.env</code>
            .
          </p>
        </div>
      ) : !isConnected ? (
        <SplashScreen onConnect={handleConnect} />
      ) : isSettingsOpen ? (
        <SettingsScreen onBack={() => setIsSettingsOpen(false)} />
      ) : !gameMode ? (
        <ModeSelectScreen
          onSelectMode={handleStartGame}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isLoading={playroomLoading || isAutoJoining}
        />
      ) : (
        // Game Loaded
        <GameEngineProvider>
          <CardRpgGame
            userAddress={userAddress}
            currentEpoch={1}
            availablePoints={1000000000n}
            onStandingsRefresh={() => {}}
            onGameComplete={() => {
              // Optional: Handle return to menu
              // location.reload();
            }}
            gameMode={gameMode || "single"}
          />
        </GameEngineProvider>
      )}
    </Layout>
  );
}
