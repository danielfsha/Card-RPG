import { useState, useEffect } from "react";
import { insertCoin } from "playroomkit";
import { Toaster } from "react-hot-toast";
import { useWallet } from "../src/hooks/useWallet";
import { SplashScreen } from "./pages/SplashScreen";
import { ModeSelectScreen } from "./pages/ModeSelectScreen";
import { SettingsScreen } from "./pages/SettingsScreen";
import { LobbyScreen } from "./pages/LobbyScreen";

function App() {
  const { publicKey, isConnected, isConnecting, connect, error } = useWallet();
  
  const [gameMode, setGameMode] = useState<"single" | "multi" | null>(null);
  const [playroomLoading, setPlayroomLoading] = useState(false);
  const [initRoomCode, setInitRoomCode] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inLobby, setInLobby] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
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
    joinRoomCode?: string,
  ) => {
    setPlayroomLoading(true);
    try {
      // Initialize Playroom
      await insertCoin({
        streamMode: false,
        skipLobby: true,
        roomCode: joinRoomCode || undefined,
      });

      setGameMode(mode);
      setInLobby(true);
    } catch (e) {
      console.error("Failed to start game:", e);
    } finally {
      setPlayroomLoading(false);
      setIsAutoJoining(false);
    }
  };

  const handleStartGameFromLobby = () => {
    setInLobby(false);
    setGameStarted(true);
  };

  const handleConnect = async () => {
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

  // Reset all state if wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setGameMode(null);
      setInLobby(false);
      setGameStarted(false);
      setIsSettingsOpen(false);
      setPlayroomLoading(false);
    }
  }, [isConnected]);

  return (
    <div className="min-h-screen bg-[url(/background.png)] ">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1f2937',
            color: '#fff',
            fontFamily: 'var(--font-slab)',
            fontWeight: 700,
          },
        }}
      />
      {!isConnected ? (
        <SplashScreen onConnect={handleConnect} error={error} isConnecting={isConnecting} />
      ) : isSettingsOpen ? (
        <SettingsScreen onBack={() => setIsSettingsOpen(false)} />
      ) : !gameMode ? (
        <ModeSelectScreen
          onSelectMode={handleStartGame}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isLoading={playroomLoading || isAutoJoining}
        />
      ) : inLobby ? (
        <LobbyScreen onStartGame={handleStartGameFromLobby} />
      ) : gameStarted ? (
        // Game Loaded - Placeholder for actual poker game
        <div className="w-full min-h-screen flex flex-col items-center justify-center p-4">
          <div className="bg-black/50 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-12 text-center">
            <h3 className="text-white text-3xl mb-6 font-bold">
              GAME STARTING
            </h3>
            <p className="text-white/70 mb-4">Mode: {gameMode}</p>
            <p className="text-white/70">Poker game will load here...</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;

