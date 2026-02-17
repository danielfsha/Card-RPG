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
        <div className="p-12 text-center">
          <h3 className="text-white text-3xl mb-6 font-bold">LOADING</h3>
          <p className="text-white/70">Initializing game environment...</p>
        </div>
      </div>
    );
  }

  if (inJoinMode) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center p-4">
        <div className="bg-gradient-to-br from-gray-900 to-green-900 border-2 border-white/20 text-white p-8 w-full max-w-2xl rounded-sm">
          <h3 className="text-white text-3xl mb-8 text-center font-bold">
            JOIN GAME
          </h3>
          
          <form onSubmit={handleJoinSubmit} className="space-y-6">
            {/* Room Code Input */}
            <div className="space-y-3">
              <div className="text-white/70 text-sm text-center">
                Enter Room Code
              </div>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="XXXX"
                maxLength={4}
                className="w-full px-6 py-4 text-6xl text-center tracking-wider rounded-xl border-2 border-white/20 bg-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/40 font-bold uppercase"
                disabled={isLoading}
                autoFocus
              />
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-4 pt-4">
              <GlossyButton
                type="submit"
                disabled={!joinCode.trim() || isLoading}
                className="w-full bg-green-600 hover:bg-green-700 py-4"
              >
                {isLoading ? "Joining..." : "Join Game"}
              </GlossyButton>
              <GlossyButton
                type="button"
                onClick={() => {
                  setInJoinMode(false);
                  setJoinCode("");
                }}
                disabled={isLoading}
                className="w-full bg-gray-600 hover:bg-gray-700 py-4"
              >
                Back
              </GlossyButton>
            </div>
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
