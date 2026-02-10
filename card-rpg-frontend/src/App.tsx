import { useState, useEffect } from "react";
import { insertCoin, isStreamScreen } from "playroomkit";
import { config } from "./config";
import { Layout } from "./components/Layout";
import { useWallet } from "./hooks/useWallet";
import { GameEngineProvider } from "./hooks/useGameEngine";
import { CardRpgGame } from "./games/card-rpg/CardRpgGame";

const GAME_ID = "card-rpg";
const GAME_TITLE = import.meta.env.VITE_GAME_TITLE || "Card Rpg";
const GAME_TAGLINE =
  import.meta.env.VITE_GAME_TAGLINE || "On-chain game on Stellar";

export default function App() {
  const { publicKey, isConnected, isConnecting, error, isDevModeAvailable } =
    useWallet();
  const userAddress = publicKey ?? "";
  const contractId = config.contractIds[GAME_ID] || "";
  const hasContract = contractId && contractId !== "YOUR_CONTRACT_ID";
  const devReady = isDevModeAvailable();

  const [gameMode, setGameMode] = useState<"single" | "multi" | null>(null);
  const [playroomLoading, setPlayroomLoading] = useState(false);
  const [initRoomCode, setInitRoomCode] = useState<string | null>(null);

  // Check for room code in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get("room") || params.get("r");
    if (roomCode) {
      setInitRoomCode(roomCode);
    }
  }, []);

  const handleStartGame = async (mode: "single" | "multi") => {
    setPlayroomLoading(true);
    try {
      if (mode === "multi") {
        // Initialize Playroom with Lobby
        await insertCoin({
          streamMode: false,
          skipLobby: false,
          // If we have a room code, Playroom automatically handles it via URL
        });
      } else {
        // Initialize Playroom in solo mode
        await insertCoin({
          streamMode: false,
          skipLobby: true,
        });
      }
      setGameMode(mode);
    } catch (e) {
      console.error("Failed to start game:", e);
    } finally {
      setPlayroomLoading(false);
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
      handleStartGame("multi");
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
      ) : !devReady ? (
        <div className="card">
          <h3 className="gradient-text">Dev Wallets Missing</h3>
          <p style={{ color: "var(--color-ink-muted)", marginTop: "0.75rem" }}>
            Run <code>bun run setup</code> to generate dev wallets for Player 1
            and Player 2.
          </p>
        </div>
      ) : !isConnected ? (
        <div className="card">
          <h3 className="gradient-text">Connecting Dev Wallet</h3>
          <p style={{ color: "var(--color-ink-muted)", marginTop: "0.75rem" }}>
            The dev wallet switcher auto-connects Player 1. Use the switcher to
            toggle players.
          </p>
          {error && (
            <div className="notice error" style={{ marginTop: "1rem" }}>
              {error}
            </div>
          )}
          {isConnecting && (
            <div className="notice info" style={{ marginTop: "1rem" }}>
              Connecting...
            </div>
          )}
        </div>
      ) : !gameMode ? (
        // Main Menu
        <div className="card" style={{ textAlign: "center" }}>
          <h3 className="gradient-text" style={{ marginBottom: "2rem" }}>
            Choose Game Mode
          </h3>

          <div
            style={{
              display: "flex",
              gap: "1rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              className="action-button"
              onClick={() => handleStartGame("single")}
              disabled={playroomLoading}
              style={{ padding: "1.5rem", minWidth: "150px" }}
            >
              Single Player
              <div
                style={{
                  fontSize: "0.8rem",
                  opacity: 0.7,
                  marginTop: "0.5rem",
                  fontWeight: "normal",
                }}
              >
                Play locally or against bot
              </div>
            </button>
            <button
              className="action-button"
              onClick={() => handleStartGame("multi")}
              disabled={playroomLoading}
              style={{ padding: "1.5rem", minWidth: "150px" }}
            >
              Multiplayer
              <div
                style={{
                  fontSize: "0.8rem",
                  opacity: 0.7,
                  marginTop: "0.5rem",
                  fontWeight: "normal",
                }}
              >
                Create or join a lobby
              </div>
            </button>
          </div>

          {playroomLoading && (
            <div className="notice info" style={{ marginTop: "2rem" }}>
              Initializing game environment...
            </div>
          )}
        </div>
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
          />
        </GameEngineProvider>
      )}
    </Layout>
  );
}
