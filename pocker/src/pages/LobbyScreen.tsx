import { useState, useEffect } from "react";
import { usePlayersList, myPlayer, isHost, getRoomCode } from "playroomkit";
import GlossyButton from "../components/GlossyButton";
import { useWallet } from "../hooks/useWallet";
import toast from "react-hot-toast";

interface LobbyScreenProps {
  onStartGame: () => void;
}

export function LobbyScreen({ onStartGame }: LobbyScreenProps) {
  const { publicKey } = useWallet();
  const players = usePlayersList(true);
  const me = myPlayer();
  const [isReady, setIsReady] = useState(false);
  const [allReady, setAllReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const host = isHost();
  const roomCode = getRoomCode() || "LOADING...";

  // Sync ready state to Playroom
  useEffect(() => {
    if (me) {
      me.setState("ready", isReady);
      me.setState("address", publicKey);
    }
  }, [isReady, me, publicKey]);

  // Check if all players are ready
  useEffect(() => {
    if (players.length === 2) {
      const ready = players.every((p: any) => p.getState("ready") === true);
      setAllReady(ready);

      // Start countdown when all ready
      if (ready && countdown === null) {
        setCountdown(5);
      } else if (!ready && countdown !== null) {
        // Reset countdown if anyone becomes not ready
        setCountdown(null);
      }
    } else {
      setAllReady(false);
      setCountdown(null);
    }
  }, [players, countdown]);

  // Countdown timer
  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      onStartGame();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, onStartGame]);

  const handleToggleReady = () => {
    setIsReady(!isReady);
  };

  const copyRoomCode = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    navigator.clipboard.writeText(url);
    toast.success("Room link copied!");
  };

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center p-4">
      <div className="bg-black/50 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-12 w-full max-w-2xl">
        <h3 className="text-white text-3xl mb-8 text-center font-bold">
          GAME LOBBY
        </h3>

        {/* Room Code */}
        <div className="mb-8 bg-white/5 p-4 rounded-xl border border-white/10">
          <div className="text-white/70 text-sm mb-2 text-center">
            Room Code
          </div>
          <div className="flex items-center justify-center gap-4">
            <div className="text-white text-2xl font-mono tracking-wider font-bold">
              {roomCode}
            </div>
            <button
              onClick={copyRoomCode}
              className="h-10 w-10 p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
              title="Copy room link"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 512 512"
                className="fill-white"
              >
                <path d="M 416 336 L 224 336 L 416 336 L 224 336 Q 209 335 208 320 L 208 64 L 208 64 Q 209 49 224 48 L 364 48 L 364 48 L 432 116 L 432 116 L 432 320 L 432 320 Q 431 335 416 336 L 416 336 Z M 224 384 L 416 384 L 224 384 L 416 384 Q 443 383 461 365 Q 479 347 480 320 L 480 116 L 480 116 Q 480 96 466 82 L 398 14 L 398 14 Q 384 0 364 0 L 224 0 L 224 0 Q 197 1 179 19 Q 161 37 160 64 L 160 320 L 160 320 Q 161 347 179 365 Q 197 383 224 384 L 224 384 Z M 96 128 Q 69 129 51 147 L 51 147 L 51 147 Q 33 165 32 192 L 32 448 L 32 448 Q 33 475 51 493 Q 69 511 96 512 L 288 512 L 288 512 Q 315 511 333 493 Q 351 475 352 448 L 352 416 L 352 416 L 304 416 L 304 416 L 304 448 L 304 448 Q 303 463 288 464 L 96 464 L 96 464 Q 81 463 80 448 L 80 192 L 80 192 Q 81 177 96 176 L 128 176 L 128 176 L 128 128 L 128 128 L 96 128 L 96 128 Z" />
              </svg>
            </button>
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
          <div className="mb-6 bg-blue-500/20 border-2 border-blue-500/50 rounded-xl p-4">
            <p className="text-blue-200 text-center text-sm font-bold">
              Share the room code with a friend to start playing
            </p>
          </div>
        )}

        {/* Ready Button */}
        <div className="flex flex-col gap-4">
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

          {host && players.length === 2 && allReady && countdown === null && (
            <GlossyButton onClick={onStartGame} className="w-full">
              Start Game Now
            </GlossyButton>
          )}
        </div>
      </div>
    </div>
  );
}
