import type { Game } from "../bindings";

interface ActiveGameProps {
  gamePhase: "guess" | "reveal" | "complete" | "create";
  gameState: Game | null;
  userAddress: string;
  guess: number | null;
  setGuess: (val: number | null) => void;
  loading: boolean;
  isBusy: boolean;
  handleMakeGuess: () => void;
  handleRevealWinner: () => void;
  handleStartNewGame: () => void;
}

export function ActiveGame({
  gamePhase,
  gameState,
  userAddress,
  guess,
  setGuess,
  loading,
  isBusy,
  handleMakeGuess,
  handleRevealWinner,
  handleStartNewGame,
}: ActiveGameProps) {
  if (gamePhase === "create" || !gameState) {
    return null;
  }

  const isPlayer1 = gameState.player1 === userAddress;
  const isPlayer2 = gameState.player2 === userAddress;
  const hasGuessed = isPlayer1
    ? gameState.player1_guess !== null && gameState.player1_guess !== undefined
    : isPlayer2
      ? gameState.player2_guess !== null &&
        gameState.player2_guess !== undefined
      : false;

  const winningNumber = gameState.winning_number;
  const player1Guess = gameState.player1_guess;
  const player2Guess = gameState.player2_guess;

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

  return (
    <>
      {/* GUESS PHASE */}
      {gamePhase === "guess" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              className={`p-5 rounded-xl border-2 ${isPlayer1 ? "border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50 shadow-lg" : "border-gray-200 bg-white"}`}
            >
              <div className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-1">
                Player 1
              </div>
              <div className="font-mono text-sm font-semibold mb-2 text-gray-800">
                {gameState.player1.slice(0, 8)}...{gameState.player1.slice(-4)}
              </div>
              <div className="text-xs font-semibold text-gray-600">
                Points:{" "}
                {(Number(gameState.player1_points) / 10000000).toFixed(2)}
              </div>
              <div className="mt-3">
                {gameState.player1_guess !== null &&
                gameState.player1_guess !== undefined ? (
                  <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 text-white text-xs font-bold shadow-md">
                    ✓ Guessed
                  </div>
                ) : (
                  <div className="inline-block px-3 py-1 rounded-full bg-gray-200 text-gray-600 text-xs font-bold">
                    Waiting...
                  </div>
                )}
              </div>
            </div>

            <div
              className={`p-5 rounded-xl border-2 ${isPlayer2 ? "border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50 shadow-lg" : "border-gray-200 bg-white"}`}
            >
              <div className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-1">
                Player 2
              </div>
              <div className="font-mono text-sm font-semibold mb-2 text-gray-800">
                {gameState.player2.slice(0, 8)}...{gameState.player2.slice(-4)}
              </div>
              <div className="text-xs font-semibold text-gray-600">
                Points:{" "}
                {(Number(gameState.player2_points) / 10000000).toFixed(2)}
              </div>
              <div className="mt-3">
                {gameState.player2_guess !== null &&
                gameState.player2_guess !== undefined ? (
                  <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 text-white text-xs font-bold shadow-md">
                    ✓ Guessed
                  </div>
                ) : (
                  <div className="inline-block px-3 py-1 rounded-full bg-gray-200 text-gray-600 text-xs font-bold">
                    Waiting...
                  </div>
                )}
              </div>
            </div>
          </div>

          {(isPlayer1 || isPlayer2) && !hasGuessed && (
            <div className="space-y-4">
              <label className="block text-sm font-bold text-gray-700">
                Make Your Guess (1-10)
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <button
                    key={num}
                    onClick={() => setGuess(num)}
                    className={`p-4 rounded-xl border-2 font-black text-xl transition-all ${
                      guess === num
                        ? "border-purple-500 bg-gradient-to-br from-purple-500 to-pink-500 text-white scale-110 shadow-2xl"
                        : "border-gray-200 bg-white hover:border-purple-300 hover:shadow-lg hover:scale-105"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <button
                onClick={handleMakeGuess}
                disabled={isBusy || guess === null}
                className="w-full mt-2.5 py-4 rounded-xl font-bold text-white text-lg bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 hover:from-purple-600 hover:via-pink-600 hover:to-red-600 disabled:from-gray-200 disabled:to-gray-300 disabled:text-gray-500 transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:transform-none"
              >
                {loading ? "Submitting..." : "Submit Guess"}
              </button>
            </div>
          )}

          {hasGuessed && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl">
              <p className="text-sm font-semibold text-blue-700">
                ✓ You've made your guess. Waiting for other player...
              </p>
            </div>
          )}
        </div>
      )}

      {/* REVEAL PHASE */}
      {gamePhase === "reveal" && (
        <div className="space-y-6">
          <div className="p-8 bg-gradient-to-br from-yellow-50 via-orange-50 to-amber-50 border-2 border-yellow-300 rounded-2xl text-center shadow-xl">
            <div className="text-6xl mb-4">🎊</div>
            <h3 className="text-2xl font-black text-gray-900 mb-3">
              Both Players Have Guessed!
            </h3>
            <p className="text-sm font-semibold text-gray-700 mb-6">
              Click below to reveal the winner
            </p>
            <button
              onClick={handleRevealWinner}
              disabled={isBusy}
              className="px-10 py-4 rounded-xl font-bold text-white text-lg bg-gradient-to-r from-yellow-500 via-orange-500 to-amber-500 hover:from-yellow-600 hover:via-orange-600 hover:to-amber-600 disabled:from-gray-200 disabled:to-gray-300 disabled:text-gray-500 transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:transform-none"
            >
              {loading ? "Revealing..." : "Reveal Winner"}
            </button>
          </div>
        </div>
      )}

      {/* COMPLETE PHASE */}
      {gamePhase === "complete" && (
        <div className="space-y-6">
          <div className="p-10 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border-2 border-green-300 rounded-2xl text-center shadow-2xl">
            <div className="text-7xl mb-6">🏆</div>
            <h3 className="text-3xl font-black text-gray-900 mb-4">
              Game Complete!
            </h3>
            <div className="text-2xl font-black text-green-700 mb-6">
              Winning Number: {gameState.winning_number}
            </div>
            <div className="space-y-3 mb-6">
              <div className="p-4 bg-white/70 border border-green-200 rounded-xl">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-1">
                  Player 1
                </p>
                <p className="font-mono text-xs text-gray-700 mb-2">
                  {gameState.player1.slice(0, 8)}...
                  {gameState.player1.slice(-4)}
                </p>
                <p className="text-sm font-semibold text-gray-800">
                  Guess: {gameState.player1_guess ?? "—"}
                  {player1Distance !== null
                    ? ` (distance ${player1Distance})`
                    : ""}
                </p>
              </div>

              <div className="p-4 bg-white/70 border border-green-200 rounded-xl">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-1">
                  Player 2
                </p>
                <p className="font-mono text-xs text-gray-700 mb-2">
                  {gameState.player2.slice(0, 8)}...
                  {gameState.player2.slice(-4)}
                </p>
                <p className="text-sm font-semibold text-gray-800">
                  Guess: {gameState.player2_guess ?? "—"}
                  {player2Distance !== null
                    ? ` (distance ${player2Distance})`
                    : ""}
                </p>
              </div>
            </div>
            {gameState.winner && (
              <div className="mt-6 p-5 bg-white border-2 border-green-200 rounded-xl shadow-lg">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">
                  Winner
                </p>
                <p className="font-mono text-sm font-bold text-gray-800">
                  {gameState.winner.slice(0, 8)}...{gameState.winner.slice(-4)}
                </p>
                {gameState.winner === userAddress && (
                  <p className="mt-3 text-green-700 font-black text-lg">
                    🎉 You won!
                  </p>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleStartNewGame}
            className="w-full py-4 rounded-xl font-bold text-gray-700 bg-gradient-to-r from-gray-200 to-gray-300 hover:from-gray-300 hover:to-gray-400 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            Start New Game
          </button>
        </div>
      )}
    </>
  );
}
