import React from "react";
import { useGameEngine } from "../hooks/useGameEngine";
import { myPlayer } from "playroomkit";
import { POSITION, type DeckCard } from "../lib/const";

const Game = () => {
  const {
    timer,
    round,
    phase,
    player1LP,
    player2LP,
    currentPlayer,
    hands,
    decks,
    field,
    selectedHandIndex,
    selectedPosition,
    selectedAttackerIndex,
    playerSummons,
    performPlayerAction,
    drawCard,
  } = useGameEngine();

  const me = myPlayer();
  if (!me)
    return (
      <div className="flex items-center justify-center h-screen">
        Connecting...
      </div>
    );

  const myId = me.id;
  const turnSummons = playerSummons[myId] || 0;
  const allPlayerIds = Object.keys(hands).sort();
  const opponentId = Object.keys(hands).find((id) => id !== myId);

  const myHand = hands[myId] || [];
  const myDeck = decks[myId] || [];
  const myField = field[myId] || [null, null, null, null, null];
  const oppField = opponentId
    ? field[opponentId] || [null, null, null, null, null]
    : [null, null, null, null, null];
  const oppHandCount = opponentId ? (hands[opponentId] || []).length : 0;

  const isPlayer1 = allPlayerIds[0] === myId;
  const myLP = isPlayer1 ? player1LP : player2LP;
  const oppLP = isPlayer1 ? player2LP : player1LP;
  const isMyTurn =
    (isPlayer1 && currentPlayer === 1) || (!isPlayer1 && currentPlayer === 2);

  // Handlers
  const handleHandClick = (index: number) => {
    if (!isMyTurn || phase !== "MAIN") return;
    if (turnSummons >= 1) {
      alert("Only 1 summon per turn!");
      return;
    }
    performPlayerAction(myId, {
      type: "SELECT_HAND_CARD",
      payload: { index },
    });
  };

  const handleFieldClick = (isMine: boolean, index: number) => {
    if (!isMyTurn) return;

    if (phase === "SELECT_ZONE" && isMine) {
      performPlayerAction(myId, {
        type: "SELECT_ZONE",
        payload: { index },
      });
    }

    // New Rules: Attack from MAIN phase (or BATTLE phase if internal logic uses it)
    // To support "Choose Summon OR Attack", we allow selecting attacker in MAIN phase too?
    // Engine uses "ENTER_BATTLE" to switch to BATTLE phase.
    // If the user clicks a monster on field in MAIN phase, it should probably initiate Attack selection.
    // However, existing logic checks `phase === "BATTLE"`.
    // Let's allow selecting attacker if phase is MAIN or BATTLE.
    if ((phase === "MAIN" || phase === "BATTLE") && isMine) {
      // Check if we already summoned? The "One Action" rule is handled by user choice.
      // If I summon, turn ends. If I attack, turn ends.
      // So if I am here, I haven't summoned yet (because turn would have ended).
      // So I can choose to attack.

      // Auto-switch phase validation is done in Engine usually, but here we trigger SELECT_ATTACKER.
      // We first need to transition to Battle state implicitly?
      // Or just send SELECT_ATTACKER and let engine handle state change?
      // Engine `SELECT_ATTACKER` checks `if (phase !== "BATTLE") return;`
      // So we must `ENTER_BATTLE` first? Or update engine to allow attack from MAIN.

      // Simplest: "Clicking a field monster enters attack mode"
      // We'll update this handler to just try SELECT_ATTACKER, but we need to change Engine to accept it from MAIN
      // OR we call ENTER_BATTLE then SELECT_ATTACKER.
      // Let's assume the user manually clicked "Attack Phase" or we make it seamless.
      // "choose the existing monster to attack" implies seamless.

      // Update: Let's trigger ENTER_BATTLE first if in MAIN?
      // No, that's async.
      // Let's change the Condition: if `phase === "MAIN"`, and user clicks Field Card, treat as Attack Attempt.
      // We will perform a custom action or just use SELECT_ATTACKER and update engine logic to allow it in MAIN (auto-switching).

      performPlayerAction(myId, {
        type: "SELECT_ATTACKER",
        payload: { index },
      });
    }

    if (phase === "SELECT_TARGET" && !isMine) {
      performPlayerAction(myId, {
        type: "ATTACK_TARGET",
        payload: { index },
      });
    }
  };

  const handleDirectAttack = () => {
    if (phase === "SELECT_TARGET") {
      performPlayerAction(myId, {
        type: "ATTACK_TARGET",
        payload: { index: "DIRECT" },
      });
    }
  };

  const handleDraw = () => {
    // Optional draw: allow during your turn, MAIN phase, and if deck has cards
    if (!isMyTurn || phase !== "MAIN") return;
    if (!myDeck || myDeck.length === 0) return;
    drawCard(myId);
  };

  const handleCancel = () => {
    if (phase === "SELECT_POSITION" || phase === "SELECT_ZONE") {
      performPlayerAction(myId, { type: "CANCEL_SUMMON" });
    }
    if (phase === "SELECT_TARGET") {
      performPlayerAction(myId, { type: "CANCEL_ATTACK" });
    }
  };

  const nextPhase = () => {
    // Manually end turn if player chooses not to act
    if (phase === "MAIN" || phase === "BATTLE") {
      performPlayerAction(myId, { type: "END_PHASE" });
    }
  };

  const renderCard = (
    card: DeckCard | null,
    isMine: boolean,
    index: number,
    isHand: boolean,
  ) => {
    if (!card && !isHand) {
      return (
        <div
          key={index}
          className={`w-24 h-36 border-2 border-dashed border-gray-400 rounded flex items-center justify-center m-1 bg-gray-100
             ${isMine && phase === "SELECT_ZONE" ? "bg-green-100 cursor-pointer hover:bg-green-200" : ""}
             ${!isMine && phase === "SELECT_TARGET" ? "cursor-not-allowed opacity-50" : ""}
          `}
          onClick={() => {
            // Prevent clicking empty opponent zones during attack phase
            if (!isMine && phase === "SELECT_TARGET") return;
            if (!isHand) handleFieldClick(isMine, index);
          }}
        >
          <span className="text-xs text-gray-400">Zone {index + 1}</span>
        </div>
      );
    }

    if (!card) return null;

    const isSelected = isHand && index === selectedHandIndex;
    const isAttacker = !isHand && isMine && index === selectedAttackerIndex;

    // Type assertion for position (safe since engine adds it)
    const cardWithPosition = card as DeckCard & { position?: string };
    const isDefense =
      cardWithPosition.position === POSITION.DEFENSE ||
      cardWithPosition.position === POSITION.DEFENSE_DOWN;
    const isFaceDown = cardWithPosition.position === POSITION.DEFENSE_DOWN;

    return (
      <div
        key={index}
        className={`w-24 h-36 border-2 border-black rounded-lg flex flex-col items-center justify-between p-2 m-1 bg-gradient-to-br from-white to-gray-50 shadow-md relative transition-all duration-200 hover:shadow-lg
          ${isHand ? "cursor-pointer hover:-translate-y-2 hover:scale-105" : "cursor-default"}
          ${!isHand && !isMine && phase === "SELECT_TARGET" ? "cursor-crosshair hover:scale-105 ring-4 ring-red-400 ring-offset-2 animate-pulse" : ""}
          ${isSelected ? "ring-4 ring-blue-500 ring-offset-2 shadow-blue-500/50" : ""}
          ${isAttacker ? "ring-4 ring-red-500 ring-offset-2 shadow-red-500/50 animate-pulse" : ""}
          ${isDefense ? "bg-gray-200/60" : ""}
        `}
        style={isDefense ? { transform: "rotate(90deg)" } : {}}
        onClick={() =>
          isHand ? handleHandClick(index) : handleFieldClick(isMine, index)
        }
      >
        {!isFaceDown || isMine ? (
          <>
            <div className="font-bold text-xs text-center leading-tight text-gray-800 min-h-[2.5rem] flex items-center">
              {card.name}
            </div>
            <div className="text-2xl mb-1">👾</div>
            <div className="flex w-full justify-between text-xs font-bold tracking-wide">
              <span className="text-red-600 bg-red-100 px-1 py-0.5 rounded">
                ATK
                <br />
                {card.attack}
              </span>
              <span className="text-blue-600 bg-blue-100 px-1 py-0.5 rounded">
                DEF
                <br />
                {card.defense}
              </span>
            </div>
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-700 to-amber-900 rounded-lg flex items-center justify-center text-white shadow-inner">
            <span className="text-lg font-bold">?</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gradient-to-br from-slate-200 via-blue-50 to-indigo-100 p-4 select-none overflow-hidden">
      {/* HUD */}
      <div className="flex justify-between items-center mb-4 p-4 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border">
        <div className="bg-red-500/10 p-4 rounded-xl border border-red-200">
          <div className="font-bold text-lg text-red-800">
            Opponent LP: {oppLP}
          </div>
          <div className="text-sm text-red-600">Hand: {oppHandCount} cards</div>
        </div>

        <div className="text-center p-4 bg-white/50 rounded-2xl shadow-md border backdrop-blur-sm">
          <div className="text-2xl font-black bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-1">
            Phase: {phase || "Waiting..."}
          </div>
          <div className="text-lg font-bold text-gray-700 mb-1">
            Turn {round} • Player {currentPlayer}
          </div>
          <div className="text-xl font-mono text-blue-600">
            Time: {Math.floor(timer / 60)}:
            {(timer % 60).toString().padStart(2, "0")}
          </div>

          {isMyTurn ? (
            <div className="bg-green-100/80 px-4 py-1 rounded-full text-green-700 font-bold border border-green-200 mt-2">
              YOUR TURN
            </div>
          ) : (
            <div className="bg-red-100/80 px-4 py-1 rounded-full text-red-700 font-bold border border-red-200 mt-2">
              OPPONENT'S TURN
            </div>
          )}

          {isMyTurn && (
            <div className="flex gap-2 mt-3 justify-center flex-wrap">
              {(phase === "SELECT_POSITION" ||
                phase === "SELECT_ZONE" ||
                phase === "SELECT_TARGET") && (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium shadow-md transition-all"
                >
                  Cancel
                </button>
              )}
              {(phase === "MAIN" || phase === "BATTLE") && (
                <button
                  onClick={nextPhase}
                  className="px-6 py-2 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-lg text-sm font-bold shadow-lg transition-all transform hover:-translate-y-0.5"
                >
                  End Turn
                </button>
              )}
            </div>
          )}
        </div>

        <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-200">
          <div className="font-bold text-lg text-blue-800">My LP: {myLP}</div>
          <div className="text-sm text-blue-600">
            Hand: {myHand.length} cards
          </div>
          <div className="text-xs text-blue-500 mt-1">
            Summons: {turnSummons}/1
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 border border-blue-200">
              Deck: {myDeck.length}
            </div>
            <button
              onClick={handleDraw}
              disabled={!isMyTurn || phase !== "MAIN" || myDeck.length === 0}
              className="px-3 py-1 text-xs font-bold rounded bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Draw
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-6 justify-center items-stretch">
        {/* Opponent Field */}
        <div className="flex-1 flex flex-col justify-center items-center bg-gradient-to-b from-red-50/80 to-pink-50/50 rounded-2xl p-6 shadow-inner border-2 border-red-200/50 backdrop-blur-sm">
          <div className="flex gap-3">
            {oppField.map((c, i) => renderCard(c, false, i, false))}
          </div>
          {phase === "SELECT_TARGET" && (
            <button
              onClick={handleDirectAttack}
              disabled={oppField.some((c) => c !== null)}
              className="mt-6 px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold rounded-xl shadow-2xl transition-all transform hover:-translate-y-1 disabled:cursor-not-allowed disabled:animate-none"
            >
              ⚡ Direct Attack
            </button>
          )}
        </div>

        {/* My Field */}
        <div className="flex-1 flex flex-col justify-center items-center bg-gradient-to-t from-blue-50/80 to-cyan-50/50 rounded-2xl p-6 shadow-inner border-2 border-blue-200/50 backdrop-blur-sm">
          <div className="flex gap-3">
            {myField.map((c, i) => renderCard(c, true, i, false))}
          </div>
        </div>
      </div>

      {/* My Hand */}
      <div className="h-44 mt-4 p-4 bg-gradient-to-t from-slate-400/80 via-slate-300/90 to-transparent rounded-2xl backdrop-blur-sm border-t-2 border-slate-300 shadow-inner overflow-x-auto">
        <div className="flex gap-2 justify-center pb-4">
          {myHand.map((c, i) => renderCard(c, true, i, true))}
        </div>
      </div>

      {/* Position Selection Overlay */}
      {phase === "SELECT_POSITION" && isMyTurn && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 p-8">
          <div className="bg-white/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border-4 border-white max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-3xl font-black text-center mb-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Select Monster Position
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button
                onClick={() =>
                  performPlayerAction(myId, {
                    type: "SELECT_POSITION",
                    payload: { position: POSITION.ATTACK },
                  })
                }
                className="group relative p-8 bg-gradient-to-br from-red-100 to-red-200 hover:from-red-200 hover:to-red-300 rounded-2xl border-4 border-red-300 shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-2 hover:scale-105"
              >
                <div className="text-4xl mb-4">⚔️</div>
                <div className="font-black text-2xl text-red-700 group-hover:text-red-800 mb-2">
                  Attack Position
                </div>
                <div className="text-sm text-red-600 font-medium">
                  Face Up Attack
                </div>
              </button>

              <button
                onClick={() =>
                  performPlayerAction(myId, {
                    type: "SELECT_POSITION",
                    payload: { position: POSITION.DEFENSE },
                  })
                }
                className="group relative p-8 bg-gradient-to-br from-blue-100 to-blue-200 hover:from-blue-200 hover:to-blue-300 rounded-2xl border-4 border-blue-300 shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-2 hover:scale-105 rotate-90"
              >
                <div className="text-4xl mb-4 -rotate-90">🛡️</div>
                <div className="font-black text-2xl text-blue-700 group-hover:text-blue-800 mb-2 -rotate-90">
                  Defense Position
                </div>
                <div className="text-sm text-blue-600 font-medium -rotate-90">
                  Face Up Defense
                </div>
              </button>

              <button
                onClick={() =>
                  performPlayerAction(myId, {
                    type: "SELECT_POSITION",
                    payload: { position: POSITION.DEFENSE_DOWN },
                  })
                }
                className="group relative p-8 bg-gradient-to-br from-amber-100 to-amber-200 hover:from-amber-200 hover:to-amber-300 rounded-2xl border-4 border-amber-300 shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-2 hover:scale-105 rotate-90"
              >
                <div className="text-4xl mb-4 -rotate-90">❓</div>
                <div className="font-black text-2xl text-amber-700 group-hover:text-amber-800 mb-2 -rotate-90">
                  Set (Face Down)
                </div>
                <div className="text-sm text-amber-600 font-medium -rotate-90">
                  Defense Face Down
                </div>
              </button>
            </div>
            <button
              onClick={handleCancel}
              className="mt-8 w-full py-3 px-8 bg-gray-400 hover:bg-gray-500 text-white font-bold rounded-2xl text-lg shadow-lg transition-all transform hover:-translate-y-1"
            >
              Cancel Summon
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Game;
