import { useGameEngine } from "../hooks/useGameEngine";
import { myPlayer } from "playroomkit";
import { POSITION, type DeckCard } from "../lib/const";
import { motion, AnimatePresence } from "framer-motion";

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
    console.log('[Draw] Attempting to draw card', {
      isMyTurn,
      phase,
      deckSize: myDeck?.length,
      myId,
    });
    // Optional draw: allow during your turn, MAIN phase, and if deck has cards
    if (!isMyTurn || phase !== "MAIN") {
      console.log('[Draw] Failed: Not your turn or not MAIN phase');
      return;
    }
    if (!myDeck || myDeck.length === 0) {
      console.log('[Draw] Failed: No cards in deck');
      return;
    }
    console.log('[Draw] Calling drawCard');
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
          className={`w-32 h-48 border-2 border-dashed border-gray-400 rounded flex items-center justify-center m-1 bg-gray-100
             ${isMine && phase === "SELECT_ZONE" ? "bg-green-100 cursor-pointer hover:bg-green-200" : ""}
             ${!isMine && phase === "SELECT_TARGET" ? "cursor-not-allowed opacity-50" : ""}
          `}
          onClick={() => {
            // Don't allow clicking empty opponent zones during attack
            if (!isMine && phase === "SELECT_TARGET") return;
            // Only allow clicking own empty zones during SELECT_ZONE phase
            if (isMine && phase === "SELECT_ZONE") {
              handleFieldClick(isMine, index);
            }
          }}
        >
          <span className="text-xs text-gray-400">Zone {index + 1}</span>
        </div>
      );
    }

    if (!card) return null;

    const isSelected = isHand && index === selectedHandIndex;
    const isAttacker = !isHand && isMine && index === selectedAttackerIndex;

    const cardWithPosition = card as DeckCard & { position?: string };
    const isDefense =
      cardWithPosition.position === POSITION.DEFENSE ||
      cardWithPosition.position === POSITION.DEFENSE_DOWN;
    const isFaceDown = cardWithPosition.position === POSITION.DEFENSE_DOWN;
    // For hand cards, use the fan effect with Framer Motion
    if (isHand) {
      const cardId = card.id || `${card.name}-${index}`;
      const imagePath = card.image ? `/images/${card.image}.png` : '/images/back.png';
      
      if (!card.image) {
        console.warn('Card missing image field:', card);
      }
      
      return (
        <motion.img
          key={cardId}
          layoutId={cardId}
          src={imagePath}
          alt={card.Name || card.name}
          className="card-hand w-32 h-48 mx-[-20px] cursor-pointer pointer-events-auto"
          style={{
            position: 'relative',
          }}
          initial={{
            y: Math.abs(index - (myHand.length - 1) / 2) * 10,
            rotate: (index - (myHand.length - 1) / 2) * 8,
          }}
          animate={{
            scale: isSelected ? 1.1 : 1,
            y: isSelected ? -40 : Math.abs(index - (myHand.length - 1) / 2) * 10,
            rotate: isSelected ? 0 : (index - (myHand.length - 1) / 2) * 8,
            zIndex: isSelected ? 30 : 1,
          }}
          whileHover={{
            scale: 1.1,
            y: -30,
            rotate: 0,
            zIndex: 20,
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
          }}
          onClick={() => handleHandClick(index)}
          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
            console.error('Failed to load hand card image:', imagePath, card);
            e.currentTarget.src = '/images/back.png';
          }}
        />
      );
    }

    // For field cards - animated with layoutId
    const cardId = card.id || `${card.name}-field-${index}`;
    
    // Show back of card for defense position monsters (both face-down and face-up defense)
    const shouldShowBack = isDefense && !isMine;
    
    return (
      <motion.div
        key={cardId}
        layoutId={cardId}
        className={`relative pointer-events-auto
          ${!isMine && phase === "SELECT_TARGET" ? "cursor-crosshair" : ""}
          ${isAttacker ? "ring-2 ring-red-500" : ""}
        `}
        style={isDefense ? { transform: "rotate(90deg)" } : {}}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{
          scale: isAttacker ? 1.05 : 1,
          opacity: 1,
        }}
        whileHover={{
          scale: !isMine && phase === "SELECT_TARGET" ? 1.05 : 1,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
        }}
        onClick={() => handleFieldClick(isMine, index)}
      >
        <img
          src={shouldShowBack ? `/images/back.png` : `/images/${card.image}.png`}
          alt={shouldShowBack ? "Defense Position" : (card.Name || card.name)}
          className="w-32 h-48 rounded shadow-lg"
          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
            console.error('Failed to load field card image:', card.image);
            e.currentTarget.src = '/images/back.png';
          }}
        />
      </motion.div>
    );
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gradient-to-br from-slate-200 via-blue-50 to-indigo-100 p-4 select-none relative">
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

      {/* My Hand - absolute positioning with pointer-events-none on container */}
      <div className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none">
        <div className="relative h-full flex justify-center items-end pb-4">
          <AnimatePresence>
            {myHand.map((c, i) => renderCard(c, true, i, true))}
          </AnimatePresence>
        </div>
      </div>

      {/* Position Selection Overlay */}
      {phase === "SELECT_POSITION" && isMyTurn && selectedHandIndex !== null && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md">
            <h2 className="text-xl font-bold text-center mb-4">Select Position</h2>
            
            {/* Show the card being summoned */}
            <div className="flex justify-center mb-6">
              <img
                src={`/images/${myHand[selectedHandIndex].image}.png`}
                alt={myHand[selectedHandIndex].Name || myHand[selectedHandIndex].name}
                className="w-32 h-48 rounded shadow-lg"
              />
            </div>

            {/* Position options as simple list */}
            <div className="space-y-3">
              <button
                onClick={() =>
                  performPlayerAction(myId, {
                    type: "SELECT_POSITION",
                    payload: { position: POSITION.ATTACK },
                  })
                }
                className="w-full py-3 px-4 bg-red-500 hover:bg-red-600 text-white rounded transition-colors text-left"
              >
                Attack
              </button>

              <button
                onClick={() =>
                  performPlayerAction(myId, {
                    type: "SELECT_POSITION",
                    payload: { position: POSITION.DEFENSE },
                  })
                }
                className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors text-left"
              >
                Defense
              </button>

              <button
                onClick={() =>
                  performPlayerAction(myId, {
                    type: "SELECT_POSITION",
                    payload: { position: POSITION.DEFENSE_DOWN },
                  })
                }
                className="w-full py-3 px-4 bg-yellow-500 hover:bg-yellow-600 text-white rounded transition-colors text-left"
              >
                Defense (Face Down)
              </button>

              <button
                onClick={handleCancel}
                className="w-full py-3 px-4 bg-gray-400 hover:bg-gray-500 text-white rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Game;
