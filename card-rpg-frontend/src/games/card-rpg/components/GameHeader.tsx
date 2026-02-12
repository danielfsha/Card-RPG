import { getRoomCode } from "playroomkit";

interface GameHeaderProps {
  gameMode: string;
  players: any[];
  myPlayer: any;
  sessionId: number;
}

export function GameHeader({
  gameMode,
  players,
  myPlayer,
  sessionId,
}: GameHeaderProps) {
  const roomCode = getRoomCode();

  return (
    <>
      {/* Persistent Multiplayer Header */}
      {gameMode === "multi" && (
        <div className="mb-6 p-3 bg-white/60 border border-purple-100 rounded-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
              Room
            </span>
            <span className="font-mono font-bold text-gray-800 bg-white px-2 py-1 rounded border border-purple-200">
              {roomCode}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]"></div>
              <span>You</span>
            </div>
            {players
              .filter((p: any) => p.id !== myPlayer?.id)
              .map((p: any) => {
                const name = p.getState("name") || "Opponent";
                return (
                  <div key={p.id} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]"></div>
                    <span className="font-mono" title={name}>
                      {name.slice(0, 4)}...{name.slice(-4)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
      <div className="flex items-center mb-6">
        <div>
          <h2 className="text-3xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 bg-clip-text text-transparent">
            Card Rpg Game 🎲
          </h2>
          <p className="text-sm text-gray-700 font-semibold mt-1">
            Guess a number 1-10. Closest guess wins!
          </p>
          <p className="text-xs text-gray-500 font-mono mt-1">
            Session ID: {sessionId}
          </p>
        </div>
      </div>
    </>
  );
}
