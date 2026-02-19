import { useState, useEffect } from "react";
import { useGameEngine } from "../hooks/useGameEngine";
import { useWallet } from "../hooks/useWallet";
import Experience from "../components/Experience";
import toast from "react-hot-toast";

interface GameScreenProps {
  onBack: () => void;
}

export function GameScreen({ onBack }: GameScreenProps) {
  const { sessionId } = useGameEngine();
  const { publicKey } = useWallet();
  const [gameState, setGameState] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Load game state
  const loadGameState = async () => {
    if (!sessionId || sessionId === 0) {
      console.warn("[GameScreen] Invalid session ID:", sessionId);
      return null;
    }

    try {
      const { InterstellarService } = await import("../games/interstellar/interstellarService");
      const { INTERSTELLAR_CONTRACT } = await import("../utils/constants");
      
      const interstellarService = new InterstellarService(INTERSTELLAR_CONTRACT);
      const game = await interstellarService.getGame(sessionId);
      
      if (game) {
        console.log("[GameScreen] ✅ Game loaded:", game);
        setGameState(game);
        return game;
      }
      return null;
    } catch (err) {
      console.error("[GameScreen] Error loading game:", err);
      return null;
    }
  };

  // Initial load with polling
  useEffect(() => {
    if (!sessionId || sessionId === 0) {
      setLoading(false);
      return;
    }

    let pollCount = 0;
    const MAX_POLLS = 30;
    let pollInterval: NodeJS.Timeout;
    
    const pollGame = async () => {
      pollCount++;
      console.log("[GameScreen] Loading game for session:", sessionId, `(poll ${pollCount}/${MAX_POLLS})`);
      
      const game = await loadGameState();
      
      if (game) {
        setLoading(false);
        if (pollInterval) clearInterval(pollInterval);
      } else {
        if (pollCount >= MAX_POLLS) {
          console.error("[GameScreen] ❌ Game not found after maximum polling attempts");
          toast.error("Game not found. The transaction may have failed or is still being processed.");
          setLoading(false);
          if (pollInterval) clearInterval(pollInterval);
        } else {
          console.warn(`[GameScreen] Game not found yet, will retry in 3s... (${pollCount}/${MAX_POLLS})`);
        }
      }
    };

    pollGame();
    pollInterval = setInterval(pollGame, 3000);
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <div className="bg-black/50 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-12 text-center max-w-md">
          <div className="text-white text-2xl mb-4">Loading game...</div>
          <div className="text-white/70 text-sm mb-4">
            Session ID: {sessionId || "Not set"}
          </div>
          <div className="text-white/50 text-xs mb-4">
            Waiting for the blockchain to index the transaction.
            This usually takes 5-15 seconds.
          </div>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center p-4">
        <div className="bg-black/50 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-12 text-center max-w-md">
          <div className="text-white text-2xl mb-4">Waiting for game...</div>
          <div className="text-white/70 text-sm mb-4">
            Session ID: {sessionId || "Not set"}
          </div>
          <div className="text-white/50 text-xs">
            The game contract is being created. This may take a few moments.
          </div>
        </div>
      </div>
    );
  }

  // Game is loaded - show the 3D experience
  return <Experience />;
}
