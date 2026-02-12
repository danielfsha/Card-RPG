interface SetupScreenProps {
  gamePhase: "create" | "guess" | "reveal" | "complete";
  createMode: "create" | "import" | "load";
  setCreateMode: (mode: "create" | "import" | "load") => void;
  gameMode: "single" | "multi";
  isHost: boolean;
  userAddress: string;
  sessionId: number;
  availablePoints: bigint;
  player1Address: string;
  setPlayer1Address: (addr: string) => void;
  player1Points: string;
  setPlayer1Points: (pts: string) => void;
  importAuthEntryXDR: string;
  setImportAuthEntryXDR: (xdr: string) => void;
  importSessionId: string;
  importPlayer1: string;
  importPlayer1Points: string;
  importPlayer2Points: string;
  setImportPlayer2Points: (pts: string) => void;
  loadSessionId: string;
  setLoadSessionId: (id: string) => void;
  exportedAuthEntryXDR: string | null;
  setExportedAuthEntryXDR: (xdr: string | null) => void;
  setImportSessionId: (id: string) => void;
  setImportPlayer1: (addr: string) => void;
  setImportPlayer1Points: (pts: string) => void;
  setImportAuthEntryXDRState: (xdr: string) => void;
  xdrParsing: boolean;
  xdrParseSuccess: boolean;
  xdrParseError: string | null;
  loading: boolean;
  isBusy: boolean;
  quickstartLoading: boolean;
  quickstartAvailable: boolean;
  authEntryCopied: boolean;
  shareUrlCopied: boolean;
  handlePrepareTransaction: () => void;
  handleImportTransaction: () => void;
  handleLoadExistingGame: () => void;
  handleQuickStart: () => void;
  copyAuthEntryToClipboard: () => void;
  copyShareGameUrlWithAuthEntry: () => void;
  copyShareGameUrlWithSessionId: () => void;
  DEFAULT_POINTS: string;
}

export function SetupScreen({
  gamePhase,
  createMode,
  setCreateMode,
  gameMode,
  isHost,
  userAddress,
  sessionId,
  availablePoints,
  player1Address,
  setPlayer1Address,
  player1Points,
  setPlayer1Points,
  importAuthEntryXDR,
  setImportAuthEntryXDR,
  importSessionId,
  importPlayer1,
  importPlayer1Points,
  importPlayer2Points,
  setImportPlayer2Points,
  loadSessionId,
  setLoadSessionId,
  exportedAuthEntryXDR,
  setExportedAuthEntryXDR,
  setImportSessionId,
  setImportPlayer1,
  setImportPlayer1Points,
  setImportAuthEntryXDRState,
  xdrParsing,
  xdrParseSuccess,
  xdrParseError,
  loading,
  isBusy,
  quickstartLoading,
  quickstartAvailable,
  authEntryCopied,
  shareUrlCopied,
  handlePrepareTransaction,
  handleImportTransaction,
  handleLoadExistingGame,
  handleQuickStart,
  copyAuthEntryToClipboard,
  copyShareGameUrlWithAuthEntry,
  copyShareGameUrlWithSessionId,
  DEFAULT_POINTS,
}: SetupScreenProps) {
  if (gamePhase !== "create") {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      {gameMode !== "multi" && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 p-2 bg-gray-100 rounded-xl">
          <button
            onClick={() => {
              setCreateMode("create");
              setExportedAuthEntryXDR(null);
              setImportAuthEntryXDRState(""); // Using state setter wrapper if needed or direct
              // Actually passed prompt setter is setImportAuthEntryXDRState which maps to setImportAuthEntryXDR
              // Checking props... ah wait, I see setImportAuthEntryXDR and setImportAuthEntryXDRState in props.
              // Let's assume standard setImportAuthEntryXDR is the one to use for clearing
              setImportAuthEntryXDR("");
              setImportSessionId("");
              setImportPlayer1("");
              setImportPlayer1Points("");
              setImportPlayer2Points(DEFAULT_POINTS);
              setLoadSessionId("");
            }}
            className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all ${
              createMode === "create"
                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Create & Export
          </button>
          <button
            onClick={() => {
              setCreateMode("import");
              setExportedAuthEntryXDR(null);
              setLoadSessionId("");
            }}
            className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all ${
              createMode === "import"
                ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Import Auth Entry
          </button>
          <button
            onClick={() => {
              setCreateMode("load");
              setExportedAuthEntryXDR(null);
              setImportAuthEntryXDR("");
              setImportSessionId("");
              setImportPlayer1("");
              setImportPlayer1Points("");
              setImportPlayer2Points(DEFAULT_POINTS);
            }}
            className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all ${
              createMode === "load"
                ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Load Existing Game
          </button>
        </div>
      )}

      {gameMode !== "multi" && (
        <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-yellow-900">
                ⚡ Quickstart (Dev)
              </p>
              <p className="text-xs font-semibold text-yellow-800">
                Creates and signs for both dev wallets in one click. Works only
                in the Games Library.
              </p>
            </div>
            <button
              onClick={handleQuickStart}
              disabled={isBusy || !quickstartAvailable}
              className="px-4 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-200 disabled:to-gray-300 disabled:text-gray-500 transition-all shadow-md hover:shadow-lg transform hover:scale-105 disabled:transform-none"
            >
              {quickstartLoading ? "Quickstarting..." : "⚡ Quickstart Game"}
            </button>
          </div>
        </div>
      )}

      {createMode === "create" ? (
        gameMode === "multi" && !isHost ? (
          <div className="p-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-bold text-gray-700">
              Waiting for Host...
            </h3>
            <p className="text-gray-500 text-sm mt-2">
              Player 1 is preparing the game. Please wait.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Your Address (Player 1)
                </label>
                <input
                  type="text"
                  value={player1Address}
                  onChange={(e) => setPlayer1Address(e.target.value.trim())}
                  placeholder="G..."
                  className="w-full px-4 py-3 rounded-xl bg-white border-2 border-gray-200 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 text-sm font-medium text-gray-700"
                />
                <p className="text-xs font-semibold text-gray-600 mt-1">
                  Pre-filled from your connected wallet. If you change it, you
                  must be able to sign as that address.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Your Points
                </label>
                <input
                  type="text"
                  value={player1Points}
                  onChange={(e) => setPlayer1Points(e.target.value)}
                  placeholder="0.1"
                  className="w-full px-4 py-3 rounded-xl bg-white border-2 border-gray-200 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 text-sm font-medium"
                />
                <p className="text-xs font-semibold text-gray-600 mt-1">
                  Available: {(Number(availablePoints) / 10000000).toFixed(2)}{" "}
                  Points
                </p>
              </div>

              <div className="p-3 bg-blue-50 border-2 border-blue-200 rounded-xl">
                <p className="text-xs font-semibold text-blue-800">
                  ℹ️ Player 2 will specify their own address and points when
                  they import your auth entry. You only need to prepare and
                  export your signature.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t-2 border-gray-100 space-y-4">
              <p className="text-xs font-semibold text-gray-600">
                Session ID: {sessionId}
              </p>

              {!exportedAuthEntryXDR ? (
                <button
                  onClick={handlePrepareTransaction}
                  disabled={isBusy}
                  className="w-full py-4 rounded-xl font-bold text-white text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-200 disabled:to-gray-300 disabled:text-gray-500 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
                >
                  {loading ? "Preparing..." : "Prepare & Export Auth Entry"}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
                    <p className="text-xs font-bold uppercase tracking-wide text-green-700 mb-2">
                      Auth Entry XDR (Player 1 Signed)
                    </p>
                    <div className="bg-white p-3 rounded-lg border border-green-200 mb-3">
                      <code className="text-xs font-mono text-gray-700 break-all">
                        {exportedAuthEntryXDR}
                      </code>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={copyAuthEntryToClipboard}
                        className="py-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold text-sm transition-all shadow-md hover:shadow-lg transform hover:scale-105"
                      >
                        {authEntryCopied ? "✓ Copied!" : "📋 Copy Auth Entry"}
                      </button>
                      <button
                        onClick={copyShareGameUrlWithAuthEntry}
                        className="py-3 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold text-sm transition-all shadow-md hover:shadow-lg transform hover:scale-105"
                      >
                        {shareUrlCopied ? "✓ Copied!" : "🔗 Share URL"}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 text-center font-semibold">
                    Copy the auth entry XDR or share URL with Player 2 to
                    complete the transaction
                  </p>
                </div>
              )}
            </div>
          </div>
        )
      ) : createMode === "import" ? (
        /* IMPORT MODE */
        <div className="space-y-4">
          <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl">
            <p className="text-sm font-semibold text-blue-800 mb-2">
              📥 Import Auth Entry from Player 1
            </p>
            <p className="text-xs text-gray-700 mb-4">
              Paste the auth entry XDR from Player 1. Session ID, Player 1
              address, and their points will be auto-extracted. You only need to
              enter your points amount.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-2">
                  Auth Entry XDR
                  {xdrParsing && (
                    <span className="text-blue-500 text-xs animate-pulse">
                      Parsing...
                    </span>
                  )}
                  {xdrParseSuccess && (
                    <span className="text-green-600 text-xs">
                      ✓ Parsed successfully
                    </span>
                  )}
                  {xdrParseError && (
                    <span className="text-red-600 text-xs">✗ Parse failed</span>
                  )}
                </label>
                <textarea
                  value={importAuthEntryXDR}
                  onChange={(e) => setImportAuthEntryXDR(e.target.value)}
                  placeholder="Paste Player 1's signed auth entry XDR here..."
                  rows={4}
                  className={`w-full px-4 py-3 rounded-xl bg-white border-2 focus:outline-none focus:ring-4 text-xs font-mono resize-none transition-colors ${
                    xdrParseError
                      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                      : xdrParseSuccess
                        ? "border-green-300 focus:border-green-400 focus:ring-green-100"
                        : "border-blue-200 focus:border-blue-400 focus:ring-blue-100"
                  }`}
                />
                {xdrParseError && (
                  <p className="text-xs text-red-600 font-semibold mt-1">
                    {xdrParseError}
                  </p>
                )}
              </div>
              {/* Auto-populated fields from auth entry (read-only) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    Session ID (auto-filled)
                  </label>
                  <input
                    type="text"
                    value={importSessionId}
                    readOnly
                    placeholder="Auto-filled from auth entry"
                    className="w-full px-4 py-2 rounded-xl bg-gray-50 border-2 border-gray-200 text-xs font-mono text-gray-600 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    Player 1 Points (auto-filled)
                  </label>
                  <input
                    type="text"
                    value={importPlayer1Points}
                    readOnly
                    placeholder="Auto-filled from auth entry"
                    className="w-full px-4 py-2 rounded-xl bg-gray-50 border-2 border-gray-200 text-xs text-gray-600 cursor-not-allowed"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Player 1 Address (auto-filled)
                </label>
                <input
                  type="text"
                  value={importPlayer1}
                  readOnly
                  placeholder="Auto-filled from auth entry"
                  className="w-full px-4 py-2 rounded-xl bg-gray-50 border-2 border-gray-200 text-xs font-mono text-gray-600 cursor-not-allowed"
                />
              </div>
              {/* User inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    Player 2 (You)
                  </label>
                  <input
                    type="text"
                    value={userAddress}
                    readOnly
                    className="w-full px-4 py-2 rounded-xl bg-gray-50 border-2 border-gray-200 text-xs font-mono text-gray-600 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Your Points *
                  </label>
                  <input
                    type="text"
                    value={importPlayer2Points}
                    onChange={(e) => setImportPlayer2Points(e.target.value)}
                    placeholder="e.g., 0.1"
                    className="w-full px-4 py-2 rounded-xl bg-white border-2 border-blue-200 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleImportTransaction}
            disabled={
              isBusy ||
              !importAuthEntryXDR.trim() ||
              !importPlayer2Points.trim()
            }
            className="w-full py-4 rounded-xl font-bold text-white text-lg bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 hover:from-blue-600 hover:via-cyan-600 hover:to-teal-600 disabled:from-gray-200 disabled:to-gray-300 disabled:text-gray-500 transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:transform-none"
          >
            {loading ? "Importing & Signing..." : "Import & Sign Auth Entry"}
          </button>
        </div>
      ) : createMode === "load" ? (
        /* LOAD EXISTING GAME MODE */
        <div className="space-y-4">
          <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
            <p className="text-sm font-semibold text-green-800 mb-2">
              🎮 Load Existing Game by Session ID
            </p>
            <p className="text-xs text-gray-700 mb-4">
              Enter a session ID to load and continue an existing game. You must
              be one of the players.
            </p>
            <input
              type="text"
              value={loadSessionId}
              onChange={(e) => setLoadSessionId(e.target.value)}
              placeholder="Enter session ID (e.g., 123456789)"
              className="w-full px-4 py-3 rounded-xl bg-white border-2 border-green-200 focus:outline-none focus:border-green-400 focus:ring-4 focus:ring-green-100 text-sm font-mono"
            />
          </div>

          <div className="p-4 bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-xl">
            <p className="text-xs font-bold text-yellow-800 mb-2">
              Requirements
            </p>
            <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
              <li>You must be Player 1 or Player 2 in the game</li>
              <li>Game must be active (not completed)</li>
              <li>Valid session ID from an existing game</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleLoadExistingGame}
              disabled={isBusy || !loadSessionId.trim()}
              className="py-4 rounded-xl font-bold text-white text-lg bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 disabled:from-gray-200 disabled:to-gray-300 disabled:text-gray-500 transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:transform-none"
            >
              {loading ? "Loading..." : "🎮 Load Game"}
            </button>
            <button
              onClick={copyShareGameUrlWithSessionId}
              disabled={!loadSessionId.trim()}
              className="py-4 rounded-xl font-bold text-white text-lg bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:from-gray-200 disabled:to-gray-300 disabled:text-gray-500 transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:transform-none"
            >
              {shareUrlCopied ? "✓ Copied!" : "🔗 Share Game"}
            </button>
          </div>
          <p className="text-xs text-gray-600 text-center font-semibold">
            Load the game to continue playing, or share the URL with another
            player
          </p>
        </div>
      ) : null}
    </div>
  );
}
