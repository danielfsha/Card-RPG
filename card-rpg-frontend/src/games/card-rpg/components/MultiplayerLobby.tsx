import { getRoomCode } from "playroomkit";

interface MultiplayerLobbyProps {
  gameMode: string;
  gameStarted: boolean;
  players: any[];
  myPlayer: any;
  isMyReady: boolean;
  allReady: boolean;
  handleMultiplayerReady: () => void;
}

export function MultiplayerLobby({
  gameMode,
  gameStarted,
  players,
  myPlayer,
  isMyReady,
  allReady,
  handleMultiplayerReady,
}: MultiplayerLobbyProps) {
  if (gameMode !== "multi" || gameStarted) {
    return null;
  }

  const roomCode = getRoomCode();

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-8 shadow-xl border-2 border-purple-200">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 bg-clip-text text-transparent mb-2">
          Multiplayer Lobby
        </h2>
        <p className="text-gray-600 font-semibold mb-4">
          Waiting for players. Share this room code:
        </p>
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="text-2xl font-mono font-black tracking-widest bg-gray-100 px-4 py-2 rounded-lg border-2 border-purple-200">
            {roomCode}
          </span>
          <button
            onClick={() => {
              const url = new URL(window.location.href);
              if (typeof roomCode === "string") {
                url.searchParams.set("room", roomCode);
              }
              navigator.clipboard.writeText(url.toString());
            }}
            className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 transition"
            title="Copy Invite Link"
          >
            🔗
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto space-y-4 mb-8">
        <div className="p-4 bg-white/80 rounded-xl border border-purple-100 shadow-sm">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
            <span className="font-bold text-gray-700">
              Players ({players.length}/2)
            </span>
          </div>
          <div className="space-y-3">
            {players.map((p: any) => {
              const isMe = p.id === myPlayer?.id;
              const pName = p.getState("name") || p.id;
              const pReady = p.getState("ready");
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        pReady
                          ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                          : "bg-gray-300"
                      }`}
                    />
                    <div>
                      <div className="text-sm font-bold text-gray-800">
                        {isMe ? (
                          "You"
                        ) : (
                          <span className="font-mono" title={pName}>
                            {pName.slice(0, 6)}...{pName.slice(-4)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {isMe ? (
                          <span className="font-mono">
                            {pName.slice(0, 6)}...{pName.slice(-4)}
                          </span>
                        ) : (
                          "Opponent"
                        )}
                      </div>
                    </div>
                  </div>
                  {pReady ? (
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
                      READY
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">
                      NOT READY
                    </span>
                  )}
                </div>
              );
            })}
            {players.length === 0 && (
              <div className="text-center py-4 text-gray-400 italic">
                Connecting to room...
              </div>
            )}
            {players.length === 1 && (
              <div className="flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 bg-gray-50/50">
                <span className="animate-pulse">
                  Waiting for opponent to join...
                </span>
              </div>
            )}
          </div>
        </div>

        {players.length >= 2 && !isMyReady && (
          <div className="p-3 bg-blue-50 text-blue-800 text-sm font-semibold rounded-lg text-center border border-blue-100">
            Both players connected! Click Ready to start.
          </div>
        )}
        {players.length >= 2 && isMyReady && !allReady && (
          <div className="p-3 bg-amber-50 text-amber-800 text-sm font-semibold rounded-lg text-center border border-amber-100">
            Waiting for opponent to ready up...
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <button
          onClick={handleMultiplayerReady}
          disabled={players.length < 2 && !isMyReady}
          className={`px-8 py-4 rounded-xl font-bold text-white text-lg transition-all shadow-lg transform hover:scale-105 disabled:opacity-50 disabled:grayscale disabled:transform-none ${
            isMyReady
              ? "bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600"
              : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
          }`}
        >
          {isMyReady ? "CANCEL READY" : "READY TO PLAY"}
        </button>
      </div>
    </div>
  );
}
