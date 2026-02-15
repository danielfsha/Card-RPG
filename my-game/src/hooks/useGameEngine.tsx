import {
  getState,
  isHost,
  onPlayerJoin,
  useMultiplayerState,
  usePlayersList,
} from "playroomkit";
import React, { createContext, useContext, useEffect, useRef } from "react";
import {
  DECK,
  INITIAL_HAND_SIZE,
  INITIAL_LP,
  NORMAL_SUMMONS_PER_TURN,
  POSITION,
  type BattleResult,
  type CardPosition,
  type DeckCard,
  type GamePhase,
} from "../lib/const";
import { useControls } from "leva";

export type GameState = {
  timer: number;
  round: number;
  phase: GamePhase | null;
  player1LP: number;
  player2LP: number;
  battleResult: BattleResult;
  currentPlayer: number;
  playerStart: number;
  decks: Record<string, DeckCard[]>;
  hands: Record<string, DeckCard[]>;
  field: Record<string, ((DeckCard & { position?: CardPosition }) | null)[]>;
  graveyard: Record<string, DeckCard[]>;
  outcomes: Record<string, BattleResult>;
  playerActions: Record<string, any>;
  // Selection States
  selectedHandIndex: number | null;
  selectedZoneIndex: number | null;
  selectedPosition: CardPosition | null;
  selectedAttackerIndex: number | null;
  turnSummons: number;
  playerSummons: Record<string, number>;
  attackedZoneIndices: number[];
  performPlayerAction: (
    playerId: string,
    action: { type: string; payload?: any },
  ) => void;
  drawCard: (playerId: string) => void;
};

export type Player = {
  id: string;
  setState: (key: string, value: any) => void;
  walletAddress: string;
};

const GameEngineContext = createContext<GameState | null>(null);

export const GameEngineProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [timer, setTimer] = useMultiplayerState("timer", 0);
  const [round, setRound] = useMultiplayerState("round", 1);
  const [phase, setPhase] = useMultiplayerState<GameState["phase"]>(
    "phase",
    null,
  );
  const [battleResult, setBattleResult] = useMultiplayerState<
    GameState["battleResult"]
  >("battleResult", "NOTHING");
  const [currentPlayer, setCurrentPlayer] = useMultiplayerState(
    "currentPlayer",
    0,
  );
  const [playerStart, setPlayerStart] = useMultiplayerState("playerStart", 0);
  const [decks, setDecks] = useMultiplayerState<Record<string, DeckCard[]>>(
    "decks",
    {},
  );
  const [hands, setHands] = useMultiplayerState<Record<string, DeckCard[]>>(
    "hands",
    {},
  );
  const [field, setField] = useMultiplayerState<
    Record<string, ((DeckCard & { position?: CardPosition }) | null)[]>
  >("field", {});
  const [graveyard, setGraveyard] = useMultiplayerState<
    Record<string, DeckCard[]>
  >("graveyard", {});
  const [player1LP, setPlayer1LP] = useMultiplayerState(
    "player1LP",
    INITIAL_LP,
  );
  const [player2LP, setPlayer2LP] = useMultiplayerState(
    "player2LP",
    INITIAL_LP,
  );
  // Removed unused card count states to avoid compile errors
  const [outcomes, setOutcomes] = useMultiplayerState<
    Record<string, BattleResult>
  >("outcomes", {});
  const [playerActions, setPlayerActions] = useMultiplayerState<
    Record<string, any>
  >("playerActions", {});
  const [winner, setWinner] = useMultiplayerState<Player | null>(
    "winner",
    null,
  );

  // Selection States
  const [selectedHandIndex, setSelectedHandIndex] = useMultiplayerState<
    number | null
  >("selectedHandIndex", null);
  const [selectedZoneIndex, setSelectedZoneIndex] = useMultiplayerState<
    number | null
  >("selectedZoneIndex", null);
  const [selectedPosition, setSelectedPosition] =
    useMultiplayerState<CardPosition | null>("selectedPosition", null);
  const [selectedAttackerIndex, setSelectedAttackerIndex] = useMultiplayerState<
    number | null
  >("selectedAttackerIndex", null);
  // Change to per-player summons tracking
  const [playerSummons, setPlayerSummons] = useMultiplayerState<
    Record<string, number>
  >("playerSummons", {});
  const [attackedZoneIndices, setAttackedZoneIndices] = useMultiplayerState<
    number[]
  >("attackedZoneIndices", []);
  const [playerDraws, setPlayerDraws] = useMultiplayerState<
    Record<string, number>
  >("playerDraws", {});

  const players = usePlayersList();
  const sortedPlayers = [...players].sort((a, b) => a.id.localeCompare(b.id));

  // Helper: adjust LP for a player by ID using functional updates to avoid stale values
  const getPlayerIndexById = (pid: string) =>
    sortedPlayers.findIndex((p) => p.id === pid);
  const adjustLP = (pid: string, delta: number) => {
    const idx = getPlayerIndexById(pid);
    if (idx === 0) {
      const next = Math.max(0, player1LP + delta);
      setPlayer1LP(next);
    } else if (idx === 1) {
      const next = Math.max(0, player2LP + delta);
      setPlayer2LP(next);
    }
  };

  // DECLARE performPlayerAction BEFORE using it in gameState
  const performPlayerAction = (
    playerId: string,
    action: { type: string; payload?: any },
  ) => {
    // Validate User using Game State (hands) consistency
    // We use Object.keys(hands) to ensure we match the UI's determination of Player 1/2
    const gamePlayerIds = Object.keys(hands).sort();
    const playerIndex = gamePlayerIds.indexOf(playerId);

    const isTurn = playerIndex !== -1 && playerIndex + 1 === currentPlayer;

    // Debug logging for turn issues
    if (!isTurn) {
      console.warn(
        `Turn Check Failed: Check=${currentPlayer}, You=${playerIndex + 1} (${playerId})`,
      );
      console.log("Players:", gamePlayerIds);
    }

    if (!isTurn) {
      console.warn("Not your turn!");
      return;
    }

    // Removed unused helper endTurn to satisfy no-unused rules

    switch (action.type) {
      // --- MAIN PHASE: SELECT CARD ---
      case "SELECT_HAND_CARD":
        if (phase !== "MAIN") return;
        const currentSummons = playerSummons[playerId] || 0;
        if (currentSummons >= NORMAL_SUMMONS_PER_TURN) {
          console.log("Already summoned this turn.");
          return;
        }
        setSelectedHandIndex(action.payload.index);
        setPhase("SELECT_ZONE");
        break;

      // --- MAIN PHASE: SELECT ZONE ---
      case "SELECT_ZONE":
        if (phase !== "SELECT_ZONE") return;
        const zoneIndex = action.payload.index;
        // Default to empty field if not initialized
        const playerField = field[playerId] || [null, null, null, null, null];

        if (playerField[zoneIndex] !== null) {
          console.warn("Zone occupied!");
          return;
        }
        setSelectedZoneIndex(zoneIndex);
        setPhase("SELECT_POSITION");
        break;

      // --- MAIN PHASE: SELECT POSITION (FINALIZE SUMMON) ---
      case "SELECT_POSITION":
        if (phase !== "SELECT_POSITION") return;
        const pos = action.payload.position;
        const pField = field[playerId] || [null, null, null, null, null];

        // Execute Summon
        const playerHand = hands[playerId];
        const cardToSummon = playerHand[selectedHandIndex!];

        // Only assign position if it's not null
        const summonedCard =
          pos != null
            ? { ...cardToSummon, position: pos }
            : { ...cardToSummon };

        const newField = [...pField];
        // Use the stored zone index
        if (selectedZoneIndex === null) {
          console.error("No zone selected for summon");
          setPhase("MAIN");
          return;
        }
        newField[selectedZoneIndex] = summonedCard;

        const newHand = [...playerHand];
        newHand.splice(selectedHandIndex!, 1);

        setField({ ...field, [playerId]: newField });
        setHands({ ...hands, [playerId]: newHand });

        // AUTO END TURN AFTER SUMMON (Rule Change)
        setSelectedHandIndex(null);
        setSelectedZoneIndex(null);
        setSelectedPosition(null);

        // We update playerSummons first for the current player,
        // then update it for the next player inside endTurn logic.
        // We'll pass the updated summons map to endTurn if needed, or update differently.
        // Given state batching, this might conflict if we call both.
        // Let's manually do the end turn logic here that specifically handles the updated playerSummons.

        const nextP = currentPlayer === 1 ? 2 : 1;
        const nextPId = sortedPlayers[nextP - 1]?.id;

        // Deck-out check at turn start: if next player has no cards in deck, previous player wins
        if (nextPId) {
          const nextDeckSize = (decks[nextPId] || []).length;
          if (nextDeckSize === 0) {
            const winPlayer = sortedPlayers[currentPlayer - 1];
            setWinner(winPlayer as any);
            setPhase("END");
            console.log(
              `Deck Out: ${nextPId} has no cards at turn start. Winner: ${winPlayer.id}.`,
            );
            break;
          }
        }

        setCurrentPlayer(nextP);
        setRound(round + 1);
        setPhase("MAIN");

        const updatedSummons = {
          ...playerSummons,
          [playerId]: (playerSummons[playerId] || 0) + 1,
        };

        if (nextPId) {
          updatedSummons[nextPId] = 0;
        }
        setPlayerSummons(updatedSummons);

        setAttackedZoneIndices([]);

        if (nextPId) {
          // Drawing is now optional; no auto-draw on turn change
          setPlayerDraws({ ...playerDraws, [nextPId]: 0 });
        }
        break;

      case "CANCEL_SUMMON":
        setSelectedHandIndex(null);
        setSelectedZoneIndex(null);
        setSelectedPosition(null);
        setPhase("MAIN");
        break;

      // --- TRANSITION TO BATTLE ---
      case "ENTER_BATTLE":
        // Deprecated button action, but keeping logic just in case useful or called by mistake.
        // With new rules, we go directly from MAIN to SELECT_ATTACKER via UI clicks.
        // But "Next Phase" button is still in UI? Yes.
        // User "make it also auto end change turn as the playing rules are met".
        // The "Next Phase" button is probably not needed anymore if auto-end is strict.
        // However, if the user CHOOSES to skip their turn (do nothing), they need a button.
        if (phase !== "MAIN") return;
        setPhase("BATTLE");
        break;
      case "SELECT_ATTACKER":
        // Allow selection from MAIN or BATTLE phase to support "Seamless Choice"
        if (phase !== "BATTLE" && phase !== "MAIN") return;

        // If in MAIN, switch to BATTLE (One Action Rule: You chose Attack)
        if (phase === "MAIN") {
          // Check if already summoned (should not happen if turn ends on summon, but fail-safe)
          const cSummons = playerSummons[playerId] || 0;
          if (cSummons > 0) {
            console.log("Cannot attack after summoning (One Action Rule).");
            return;
          }
          // Implicitly enter battle
        }

        const attackerIndex = action.payload.index;
        const attackerCard = field[playerId][attackerIndex];

        if (!attackerCard) return;
        if (attackerCard.position !== POSITION.ATTACK) {
          console.log("Monster in defense cannot attack.");
          return;
        }
        if (attackedZoneIndices.includes(attackerIndex)) {
          console.log("Already attacked.");
          return;
        }

        setSelectedAttackerIndex(attackerIndex);
        setPhase("SELECT_TARGET");
        break;

      // --- BATTLE PHASE: ATTACK ---
      case "ATTACK_TARGET":
        if (phase !== "SELECT_TARGET") return;
        let targetIndex: number | "DIRECT" = action.payload.index; // index or "DIRECT"
        const opponentId = sortedPlayers[currentPlayer === 1 ? 1 : 0].id;
        // Ensure opponentField is always a 5-slot array
        const opponentField = field[opponentId] || [
          null,
          null,
          null,
          null,
          null,
        ];
        // Ensure selectedAttackerIndex is not null
        if (selectedAttackerIndex === null) {
          console.error("No attacker selected!");
          setPhase("MAIN");
          return;
        }

        const attacker = field[playerId][selectedAttackerIndex!];
        if (!attacker) {
          console.warn("Attacker is null!");
          return;
        }

        // --- ATTACK VALIDATION ---

        // Cannot select own cards as target
        if (targetIndex !== "DIRECT") {
          // opponentField is field[opponentId]
          // We need to ensure we are attacking the OPPONENT
          // The action payload just has index. We assume it's opponent's field index.
          // But verify we are not attacking ourselves?
          // The UI logic: handleFieldClick(!isMine) ensures this.
          // But let's be safe.
        }

        const atkVal =
          (typeof attacker.attack === "number"
            ? attacker.attack
            : Number(attacker.attack)) || 0;

        if (targetIndex === "DIRECT") {
          // Check if opponent has monsters
          const hasMonsters = opponentField.some((c) => c !== null);
          if (hasMonsters) {
            console.log("Cannot attack direct!");
            return;
          }
          // Deal Damage to opponent
          adjustLP(opponentId, -atkVal);
          console.log("Direct Attack!", atkVal);
        } else {
          // Battle Logic
          // If clicked empty zone, choose sensible fallback
          let defender = opponentField[targetIndex as number];
          if (!defender) {
            const occupiedIndices = opponentField
              .map((c, i) => (c ? i : -1))
              .filter((i) => i !== -1);
            if (occupiedIndices.length === 0) {
              // No monsters: treat as direct attack
              targetIndex = "DIRECT";
              adjustLP(opponentId, -atkVal);
              console.log("Direct Attack (fallback)!", atkVal);
            } else if (occupiedIndices.length === 1) {
              // Exactly one monster: auto-target it
              targetIndex = occupiedIndices[0];
              defender = opponentField[targetIndex as number];
              console.log(
                `Auto-targeting opponent monster at zone ${targetIndex} due to empty click.`,
              );
            } else {
              console.warn(
                `Defender is null at index ${targetIndex}. Opponent field:`,
                opponentField,
              );
              return;
            }
          }
          // If we fell back to direct, skip battle logic (already applied damage)
          if (targetIndex !== "DIRECT") {
            // Default position if missing (should not happen)
            const defPos = defender!.position || POSITION.ATTACK;

            // Ensure stats are numbers. Default to 0 if missing.
            const defVal =
              (defPos === POSITION.ATTACK
                ? defender!.attack
                : defender!.defense) || 0;
            const safeAtkVal = atkVal || 0;
            console.log(`Battle: ${safeAtkVal} vs ${defVal} (${defPos})`);

            // Prepare Graveyard updates
            const newOppGraveyard = [...(graveyard[opponentId] || [])];
            const newMyGraveyard = [...(graveyard[playerId] || [])];
            let gyChanged = false;

            // LP deltas applied via adjustLP; avoid computing finals to prevent wrong-player updates

            if (defPos === POSITION.ATTACK) {
              if (safeAtkVal > defVal) {
                // Destroy Defender, opponent loses LP equal to difference
                const dmg = safeAtkVal - defVal;
                adjustLP(opponentId, -dmg);

                const newOppField = [...opponentField];
                newOppField[targetIndex as number] = null;
                setField({
                  ...field,
                  [opponentId]: newOppField,
                });

                newOppGraveyard.push(defender!);
                gyChanged = true;
              } else if (safeAtkVal < defVal) {
                // Destroy Attacker, current player loses LP equal to difference
                const dmg = defVal - safeAtkVal;
                adjustLP(playerId, -dmg);

                const newMyField = [...field[playerId]];
                newMyField[selectedAttackerIndex!] = null;

                setField({ ...field, [playerId]: newMyField });

                newMyGraveyard.push(attacker);
                gyChanged = true;
              } else {
                // Both Destroyed
                const newOppFieldDouble = [...opponentField];
                const newMyFieldDouble = [...field[playerId]];

                newOppFieldDouble[targetIndex as number] = null;
                newMyFieldDouble[selectedAttackerIndex!] = null;

                setField({
                  ...field,
                  [playerId]: newMyFieldDouble,
                  [opponentId]: newOppFieldDouble,
                });

                newOppGraveyard.push(defender!);
                newMyGraveyard.push(attacker);
                gyChanged = true;
              }
            } else {
              // DEFENSE or FACE-DOWN DEFENSE
              const isFaceDown = defPos === POSITION.DEFENSE_DOWN;
              if (safeAtkVal > defVal) {
                // Destroy Defender, No LP damage
                const newOppField = [...opponentField];
                newOppField[targetIndex as number] = null;
                setField({ ...field, [opponentId]: newOppField });

                newOppGraveyard.push(defender!);
                gyChanged = true;
              } else if (safeAtkVal < defVal) {
                // Attacker destroyed. LP damage ONLY if defender was face-down.
                if (isFaceDown) {
                  const dmg = defVal - safeAtkVal;
                  adjustLP(playerId, -dmg);
                }

                const newMyField = [...field[playerId]];
                newMyField[selectedAttackerIndex!] = null;
                setField({ ...field, [playerId]: newMyField });

                newMyGraveyard.push(attacker);
                gyChanged = true;
              } else {
                // Equal ATK vs DEF: no destruction, no damage
              }
            }
            // LP updates applied via adjustLP above

            if (gyChanged) {
              setGraveyard({
                ...graveyard,
                [playerId]: newMyGraveyard,
                [opponentId]: newOppGraveyard,
              });
            }
          }
        }

        // Record Attack
        setAttackedZoneIndices([
          ...attackedZoneIndices,
          selectedAttackerIndex!,
        ]);

        const targetLabel =
          targetIndex === "DIRECT"
            ? "Direct"
            : typeof targetIndex === "number"
              ? opponentField[targetIndex]?.name || `Zone ${targetIndex}`
              : "Unknown";
        console.log(`Attack Resolved: ${attacker.name} vs ${targetLabel}`);

        const nextPlayerAfterAtk = currentPlayer === 1 ? 2 : 1;
        const nextPlayerIdAfterAtk = sortedPlayers[nextPlayerAfterAtk - 1]?.id;

        // Deck-out check at turn start
        if (nextPlayerIdAfterAtk) {
          const nextDeckSize = (decks[nextPlayerIdAfterAtk] || []).length;
          if (nextDeckSize === 0) {
            const winPlayer = sortedPlayers[currentPlayer - 1];
            setWinner(winPlayer as any);
            setPhase("END");
            console.log(
              `Deck Out: ${nextPlayerIdAfterAtk} has no cards at turn start. Winner: ${winPlayer.id}.`,
            );
            break;
          }
        }

        setCurrentPlayer(nextPlayerAfterAtk);
        setRound(round + 1);
        setPhase("MAIN");
        // Clear attacker selection after resolving
        setSelectedAttackerIndex(null);

        if (nextPlayerIdAfterAtk) {
          // Reset summons for next player
          setPlayerSummons({ ...playerSummons, [nextPlayerIdAfterAtk]: 0 });
          // Reset draw count for next player
          setPlayerDraws({ ...playerDraws, [nextPlayerIdAfterAtk]: 0 });
        }
        setAttackedZoneIndices([]);
        // Drawing is now optional; no auto-draw after attack resolution
        break;

      case "CANCEL_ATTACK":
        setSelectedAttackerIndex(null);
        setPhase("MAIN");
        break;

      case "END_PHASE":
        // Manual End Turn Logic
        const nextPlayerEndPhase = currentPlayer === 1 ? 2 : 1;
        const nextPlayerIdEndPhase = sortedPlayers[nextPlayerEndPhase - 1]?.id;

        // Deck-out check at turn start
        if (nextPlayerIdEndPhase) {
          const nextDeckSize = (decks[nextPlayerIdEndPhase] || []).length;
          if (nextDeckSize === 0) {
            const winPlayer = sortedPlayers[currentPlayer - 1];
            setWinner(winPlayer as any);
            setPhase("END");
            console.log(
              `Deck Out: ${nextPlayerIdEndPhase} has no cards at turn start. Winner: ${winPlayer.id}.`,
            );
            break;
          }
        }

        setCurrentPlayer(nextPlayerEndPhase);
        setRound(round + 1);
        setPhase("MAIN");

        if (nextPlayerIdEndPhase) {
          setPlayerSummons({ ...playerSummons, [nextPlayerIdEndPhase]: 0 });
          setAttackedZoneIndices([]);
          // Drawing is now optional; no auto-draw on manual end phase
          setPlayerDraws({ ...playerDraws, [nextPlayerIdEndPhase]: 0 });
        }
        break;
    }
  };

  // Compute turnSummons for the current player
  const currentPlayerId = sortedPlayers[currentPlayer - 1]?.id;
  const turnSummons = currentPlayerId ? playerSummons[currentPlayerId] || 0 : 0;

  const drawCard = (playerId: string) => {
    // Only current player may draw
    const currentPid = sortedPlayers[currentPlayer - 1]?.id;
    if (!currentPid || playerId !== currentPid) {
      console.log("Cannot draw on opponent's turn.");
      return;
    }
    const playerDeck = decks[playerId];
    if (!playerDeck || playerDeck.length === 0) {
      console.log(`Player ${playerId} Deck Out! Win Condition: Opponent Wins`);
      return;
    }
    // Enforce maximum 1 draw per turn
    const drawsSoFar = playerDraws[playerId] || 0;
    if (drawsSoFar >= 1) {
      console.log("Already drew a card this turn.");
      return;
    }
    // Draw cost: Player loses 500 LP upon drawing (apply by playerId)
    adjustLP(playerId, -500);
    const card = playerDeck[0];
    const newDeck = playerDeck.slice(1);
    const newHand = [...(hands[playerId] || []), card];

    setDecks({
      ...decks,
      [playerId]: newDeck,
    });
    setHands({
      ...hands,
      [playerId]: newHand,
    });
    setPlayerDraws({ ...playerDraws, [playerId]: drawsSoFar + 1 });
    console.log(`Player ${playerId} drew a card. Hand size: ${newHand.length}`);
  };

  const gameState: GameState = {
    timer,
    player1LP,
    player2LP,
    round,
    phase,
    battleResult,
    currentPlayer,
    playerStart,
    decks,
    hands,
    field,
    graveyard,
    outcomes,
    playerActions,
    selectedHandIndex,
    selectedZoneIndex,
    selectedPosition,
    selectedAttackerIndex,
    turnSummons, // Use computed turnSummons
    playerSummons,
    attackedZoneIndices,
    performPlayerAction, // Now properly declared before use
    drawCard,
  };

  const shuffleDeck = (deck: DeckCard[]) => {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const startGame = () => {
    if (isHost()) {
      const shuffledDecks: Record<string, DeckCard[]> = sortedPlayers.reduce(
        (acc, player) => {
          acc[player.id] = shuffleDeck(DECK);
          return acc;
        },
        {} as Record<string, DeckCard[]>,
      );

      const initialHands: Record<string, DeckCard[]> = sortedPlayers.reduce(
        (acc, player) => {
          acc[player.id] = shuffledDecks[player.id].slice(0, INITIAL_HAND_SIZE);
          return acc;
        },
        {} as Record<string, DeckCard[]>,
      );

      const initialField: Record<
        string,
        ((DeckCard & { position?: CardPosition }) | null)[]
      > = sortedPlayers.reduce(
        (acc, player) => {
          acc[player.id] = [null, null, null, null, null];
          return acc;
        },
        {} as any, // Cast to any to avoid complex TS types for this setup or define properly
      );

      setHands(initialHands);
      setField(initialField);

      // Reset Turn-Based State
      setPlayerSummons({});
      setAttackedZoneIndices([]);
      setGraveyard({});
      setOutcomes({});
      setPlayerActions({});
      setBattleResult("NOTHING");
      setWinner(null);
      setPhase("MAIN");
      setRound(1);
      setTimer(0, true);
      setPlayerDraws({});

      const decksAfterDraw: Record<string, DeckCard[]> = { ...shuffledDecks };
      sortedPlayers.forEach((player) => {
        decksAfterDraw[player.id] =
          decksAfterDraw[player.id].slice(INITIAL_HAND_SIZE);
      });
      setDecks(decksAfterDraw);
      console.log("Decks shuffled and initial hands prepared:", {
        shuffledDecks,
        initialHands,
      });
      console.log("Initial hands:", initialHands);

      if (sortedPlayers.length > 0) {
        console.log("Player 1 Hand:", initialHands[sortedPlayers[0].id]);
      }
      if (sortedPlayers.length > 1) {
        console.log("Player 2 Hand:", initialHands[sortedPlayers[1].id]);
      } else {
        console.log("Player 2 has not joined yet.");
      }

      const startingPlayer = Math.random() < 0.5 ? 1 : 2;
      setPlayerStart(startingPlayer);
      setCurrentPlayer(startingPlayer);
      console.log(`Player ${startingPlayer} starts first`);

      players.forEach((player, index) => {
        player.setState("LP", INITIAL_LP);
        player.setState("cardCount", 0);
        player.setState("hand", initialHands[player.id]);
        player.setState("isYourTurn", index + 1 === startingPlayer);
      });
    }
  };

  // Removed deprecated phaseEnd to satisfy no-unused rules

  const { paused } = useControls({
    paused: false,
  });

  const timerInterval = useRef(0);

  const runTimer = () => {
    clearTimer();
    timerInterval.current = setInterval(() => {
      if (!isHost()) return;
      if (paused) return;
      const currentTimer = getState("timer");
      let newTime = (typeof currentTimer === "number" ? currentTimer : 0) + 1;
      setTimer(newTime, true);
    }, 1000);
  };

  const clearTimer = () => {
    clearInterval(timerInterval.current);
  };

  useEffect(() => {
    startGame();
    onPlayerJoin(startGame);
  }, []);

  // Announce winner when a player's LP reaches 0
  useEffect(() => {
    if (phase === "END") return;
    if (winner) return;
    if (sortedPlayers.length < 2) return;
    if (player1LP <= 0 || player2LP <= 0) {
      const loserIdx = player1LP <= 0 ? 0 : 1;
      const winnerIdx = loserIdx === 0 ? 1 : 0;
      const winPlayer = sortedPlayers[winnerIdx];
      setWinner(winPlayer as any);
      setPhase("END");
      console.log(`Winner: ${winPlayer.id} (opponent LP reached 0)`);
    }
  }, [player1LP, player2LP, winner, phase, sortedPlayers]);

  useEffect(() => {
    runTimer();
    return clearTimer;
  }, [phase, paused]);

  return (
    <GameEngineContext.Provider value={gameState}>
      {children}
    </GameEngineContext.Provider>
  );
};

export const useGameEngine = () => {
  const context = useContext(GameEngineContext);
  if (!context) {
    throw new Error("useGameEngine must be used within a GameEngineProvider");
  }
  return context;
};
