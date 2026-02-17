import { useState } from "react";
import GlossyButton from "../components/GlossyButton";

interface ModeSelectScreenProps {
  onSelectMode: (mode: "single" | "multi", roomCode?: string) => void;
  onOpenSettings: () => void;
  isLoading?: boolean;
}

export function ModeSelectScreen({
  onSelectMode,
  onOpenSettings,
  isLoading = false,
}: ModeSelectScreenProps) {
  const [inJoinMode, setInJoinMode] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim()) {
      window.location.href = `?room=${joinCode.trim()}`;
    }
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center p-4">
        <div className="bg-black/50 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-12 text-center">
          <h3 className="text-white text-3xl mb-6 font-bold">LOADING</h3>
          <p className="text-white/70">Initializing game environment...</p>
        </div>
      </div>
    );
  }

  if (inJoinMode) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center p-4">
        <div className="bg-black/50 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-12 w-full max-w-md">
          <h3 className="text-white text-3xl mb-8 text-center font-bold">
            JOIN GAME
          </h3>
          <form onSubmit={handleJoinSubmit} className="flex flex-col space-y-4">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Enter Room Code"
              className="px-6 py-4 text-xl text-center rounded-xl border-2 border-white/20 bg-white/10 text-white placeholder-white/50 focus:outline-none focus:border-white/40 font-bold"
              disabled={isLoading}
            />
            <GlossyButton
              type="submit"
              disabled={!joinCode.trim() || isLoading}
              className="w-full"
            >
              {isLoading ? "Joining..." : "Join Now"}
            </GlossyButton>
            <GlossyButton
              type="button"
              onClick={() => {
                setInJoinMode(false);
                setJoinCode("");
              }}
              disabled={isLoading}
              className="w-full"
            >
              Back
            </GlossyButton>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center space-y-12 p-4">
      <header className="flex flex-col items-center justify-center w-full space-y-4">
        <img src="/logo.png" className="h-16" alt="Logo" />
        {/* <p className="max-w-md text-white text-center text-2xl">
          Stellar poker is a multiplayer poker game built on Stellar blockchain
        </p> */}
      </header>

      <div className="flex flex-col items-center justify-center space-y-12 flex-1 w-full">
        

        <div className="flex flex-col space-y-4 w-full max-w-md">
          <GlossyButton
            onClick={() => onSelectMode("multi")}
            disabled={isLoading}
            className="w-full"
          >
            Create Room
          </GlossyButton>

          <GlossyButton
            onClick={() => setInJoinMode(true)}
            disabled={isLoading}
            className="w-full"
          >
            Join Room
          </GlossyButton>

          <GlossyButton
            onClick={onOpenSettings}
            disabled={isLoading}
            className="w-full"
          >
            Settings
          </GlossyButton>
        </div>
      </div>
    </div>
  );
}
