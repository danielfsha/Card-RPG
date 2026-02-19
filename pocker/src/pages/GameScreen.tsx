import { useState, useEffect } from "react";
import { useGameEngine } from "../hooks/useGameEngine";
import { useWallet } from "../hooks/useWallet";
import Header from "../components/Header";
import { PokerTable } from "../components/PokerTable";
import { PlayerCardArea } from "../components/PlayerCardArea";
import { GameControls } from "../components/GameControls";
import { CommunityCards } from "../components/CommunityCards";
import toast from "react-hot-toast";
import { ZKPokerService } from "../services/zkService";

interface GameScreenProps {
  onBack: () => void;
}

export function GameScreen({ onBack }: GameScreenProps) {
  const { sessionId } = useGameEngine();
  const { publicKey, getContractSigner } = useWallet();
  const [gameState, setGameState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // ZK state
  const [zkService] = useState(() => new ZKPokerService());
  const [myCards, setMyCards] = useState<number[]>([]);
  const [mySalt, setMySalt] = useState<bigint>();
  const [myCommitment, setMyCommitment] = useState<string>();
  const [generatingProof, setGeneratingProof] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  
  // Betting state
  const [betAmount, setBetAmount] = useState(1);
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);

  // Load game state
  const loadGameState = async () => {
    if (!sessionId || sessionId === 0) {
      console.warn("[GameScreen] Invalid session ID:", sessionId);
      return null;
    }

    try {
      const { PockerService } = await import("../games/pocker/pockerService");
      const { POCKER_CONTRACT } = await import("../utils/constants");
      
      const pockerService = new PockerService(POCKER_CONTRACT);
      const game = await pockerService.getGame(sessionId);
      
      if (game) {
        console.log("[GameScreen] ✅ Game loaded:", game);
        setGameState(game);
        return game;
      }
      return null;
    } catch (err) {
      console.error("[GameScreen] Error loading game:", err);
      return null;
    }
  };

  // Initial load with polling
  useEffect(() => {
    if (!sessionId || sessionId === 0) {
      setLoading(false);
      return;
    }

    let pollCount = 0;
    const MAX_POLLS = 30;
    let pollInterval: NodeJS.Timeout;
    
    const pollGame = async () => {
      pollCount++;
      console.log("[GameScreen] Loading game for session:", sessionId, `(poll ${pollCount}/${MAX_POLLS})`);
      
      const game = await loadGameState();
      
      if (game) {
        setLoading(false);
        if (pollInterval) clearInterval(pollInterval);
      } else {
        if (pollCount >= MAX_POLLS) {
          console.error("[GameScreen] ❌ Game not found after maximum polling attempts");
          toast.error("Game not found. The transaction may have failed or is still being processed.");
          setLoading(false);
          if (pollInterval) clearInterval(pollInterval);
        } else {
          console.warn(`[GameScreen] Game not found yet, will retry in 3s... (${pollCount}/${MAX_POLLS})`);
        }
      }
    };

    pollGame();
    pollInterval = setInterval(pollGame, 3000);
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!gameState || loading) return;
    
    const phase = gameState.phase?.tag || "Commit";
    const isPlayer1 = gameState.player1 === publicKey;
    const myCommitted = isPlayer1 
      ? gameState.player1_hole_commitment !== null 
      : gameState.player2_hole_commitment !== null;
    const opponentCommitted = isPlayer1 
      ? gameState.player2_hole_commitment !== null 
      : gameState.player1_hole_commitment !== null;
    const bothCommitted = myCommitted && opponentCommitted;
    
    // Poll if we're waiting for opponent to commit or if it's not our turn
    const shouldPoll = (myCommitted && !bothCommitted && phase === "Commit") || 
                       (phase !== "Commit" && phase !== "Complete" && Number(gameState.current_actor) !== (isPlayer1 ? 0 : 1));
    
    if (!shouldPoll) return;
    
    console.log("[GameScreen] Starting polling for game updates...");
    const pollInterval = setInterval(async () => {
      console.log("[GameScreen] Polling for game state update...");
      await loadGameState();
    }, 3000);
    
    return () => {
      console.log("[GameScreen] Stopping polling");
      clearInterval(pollInterval);
    };
  }, [gameState, loading, publicKey]);

  // Commit Phase: Generate hand and submit commitment
  const handleCommit = async () => {
    if (isCommitting) return; // Prevent spam
    
    try {
      setIsCommitting(true);
      toast.loading("Generating hand and commitment...");
      
      const cards = zkService.generateRandomHand();
      const salt = zkService.generateSalt();
      
      await zkService.initialize();
      const commitment = await zkService.commitHand(cards, salt);
      
      setMyCards(cards);
      setMySalt(salt);
      setMyCommitment(commitment);
      
      toast.dismiss();
      toast.success("Hand generated! Submitting commitment...");
      
      const { PockerService } = await import("../games/pocker/pockerService");
      const { POCKER_CONTRACT } = await import("../utils/constants");
      const signer = getContractSigner();
      
      const pockerService = new PockerService(POCKER_CONTRACT);
      await pockerService.submitHoleCommitment(
        sessionId,
        publicKey!,
        commitment,
        signer
      );
      
      toast.success("Commitment submitted!");
      
      // Reload game state to update myCommitted flag
      console.log("[GameScreen] Reloading game state after commit...");
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for blockchain
      await loadGameState();
      
    } catch (err: any) {
      toast.dismiss();
      console.error("[GameScreen] Error committing:", err);
      toast.error(err.message || "Failed to commit hand");
    } finally {
      setIsCommitting(false);
    }
  };

  // Reveal Phase: Generate and submit ZK proof
  const handleReveal = async () => {
    if (isRevealing || generatingProof) return; // Prevent spam
    
    try {
      console.log('[handleReveal] Current game state:', {
        phase: gameState?.phase,
        current_actor: gameState?.current_actor,
        player1_bet: gameState?.player1_bet,
        player2_bet: gameState?.player2_bet,
        last_action: gameState?.last_action,
        actions_this_round: gameState?.actions_this_round
      });
      
      if (gameState?.phase?.tag !== 'Showdown') {
        toast.error(`Cannot reveal winner yet. Current phase: ${gameState?.phase?.tag || 'Unknown'}. Must complete all betting rounds first.`);
        return;
      }
      
      setIsRevealing(true);
      setGeneratingProof(true);
      toast.loading("Generating ZK proof... This may take a few seconds.");
      
      const opponentCards = zkService.generateRandomHand();
      const opponentSalt = zkService.generateSalt();
      const opponentCommitment = await zkService.commitHand(opponentCards, opponentSalt);
      
      const isPlayer1 = gameState.player1 === publicKey;
      
      // Use 2 hole cards + 3 zeros (matching the commitment)
      // The circuit will verify the commitment matches, but won't verify community cards
      const myFullHand = [...myCards, 0, 0, 0];
      const opponentFullHand = [...opponentCards, 0, 0, 0];
      
      const player1Cards = isPlayer1 ? myFullHand : opponentFullHand;
      const player1Salt = isPlayer1 ? mySalt! : opponentSalt;
      const player1Commitment = isPlayer1 ? myCommitment! : opponentCommitment;
      const player2Cards = isPlayer1 ? opponentFullHand : myFullHand;
      const player2Salt = isPlayer1 ? opponentSalt : mySalt!;
      const player2Commitment = isPlayer1 ? opponentCommitment : myCommitment!;
      
      const proofData = await zkService.generateProof(
        player1Cards,
        player1Salt,
        player1Commitment,
        player2Cards,
        player2Salt,
        player2Commitment
      );
      
      toast.dismiss();
      toast.success("Proof generated! Submitting to contract...");
      
      const serializedProof = zkService.serializeProof(proofData.proof);
      const publicSignalsBuffers = proofData.publicSignals.map((signal: string) => {
        const bn = BigInt(signal);
        const hex = bn.toString(16).padStart(64, '0');
        return Buffer.from(hex, 'hex');
      });
      
      const { PockerService } = await import("../games/pocker/pockerService");
      const { POCKER_CONTRACT } = await import("../utils/constants");
      const signer = getContractSigner();
      
      const pockerService = new PockerService(POCKER_CONTRACT);
      await pockerService.revealWinner(
        sessionId,
        publicKey!,
        serializedProof,
        publicSignalsBuffers,
        signer
      );
      
      toast.success("Winner revealed!");
      
      const p1Ranking = zkService.getHandRankingName(proofData.player1Ranking);
      const p2Ranking = zkService.getHandRankingName(proofData.player2Ranking);
      const winnerText = proofData.winner === 1 ? "Player 1" : proofData.winner === 2 ? "Player 2" : "Tie";
      
      toast.success(
        `Player 1: ${p1Ranking}\nPlayer 2: ${p2Ranking}\nWinner: ${winnerText}`,
        { duration: 8000 }
      );
      
    } catch (err: any) {
      toast.dismiss();
      console.error("[GameScreen] Error revealing:", err);
      toast.error(err.message || "Failed to reveal winner");
    } finally {
      setGeneratingProof(false);
      setIsRevealing(false);
    }
  };

  const handleFold = async () => {
    try {
      toast.loading("Folding...");
      
      const { PockerService } = await import("../games/pocker/pockerService");
      const { POCKER_CONTRACT } = await import("../utils/constants");
      const signer = getContractSigner();
      
      const pockerService = new PockerService(POCKER_CONTRACT);
      
      // Create Fold action
      const foldAction = { tag: "Fold" as const, values: undefined };
      
      await pockerService.playerAction(
        sessionId,
        publicKey!,
        foldAction,
        signer
      );
      
      toast.dismiss();
      toast.success("You folded. Opponent wins!");
      
      // Reload game state
      await new Promise(resolve => setTimeout(resolve, 2000));
      await loadGameState();
      
    } catch (err: any) {
      toast.dismiss();
      console.error("[GameScreen] Error folding:", err);
      toast.error(err.message || "Failed to fold");
    }
  };

  const handleCall = async () => {
    try {
      toast.loading("Calling...");
      
      const { PockerService } = await import("../games/pocker/pockerService");
      const { POCKER_CONTRACT } = await import("../utils/constants");
      const signer = getContractSigner();
      
      const pockerService = new PockerService(POCKER_CONTRACT);
      
      // Create Call action
      const callAction = { tag: "Call" as const, values: undefined };
      
      await pockerService.playerAction(
        sessionId,
        publicKey!,
        callAction,
        signer
      );
      
      toast.dismiss();
      toast.success("Called!");
      
      // Reload game state
      await new Promise(resolve => setTimeout(resolve, 2000));
      await loadGameState();
      
    } catch (err: any) {
      toast.dismiss();
      console.error("[GameScreen] Error calling:", err);
      toast.error(err.message || "Failed to call");
    }
  };

  const handleCheck = async () => {
    try {
      toast.loading("Checking...");
      
      const { PockerService } = await import("../games/pocker/pockerService");
      const { POCKER_CONTRACT } = await import("../utils/constants");
      const signer = getContractSigner();
      
      const pockerService = new PockerService(POCKER_CONTRACT);
      
      // Create Check action
      const checkAction = { tag: "Check" as const, values: undefined };
      
      await pockerService.playerAction(
        sessionId,
        publicKey!,
        checkAction,
        signer
      );
      
      toast.dismiss();
      toast.success("Checked!");
      
      // Reload game state
      await new Promise(resolve => setTimeout(resolve, 2000));
      await loadGameState();
      
    } catch (err: any) {
      toast.dismiss();
      console.error("[GameScreen] Error checking:", err);
      toast.error(err.message || "Failed to check");
    }
  };

  const handleRaise = () => {
    if (!gameState) return;
    
    // Calculate min raise using proper no-limit poker logic
    const isPlayer1 = gameState.player1 === publicKey;
    const myBet = isPlayer1 ? gameState.player1_bet : gameState.player2_bet;
    const opponentBet = isPlayer1 ? gameState.player2_bet : gameState.player1_bet;
    const lastRaiseAmount = gameState.last_raise_amount || BigInt(0);
    
    let minRaiseStroops: bigint;
    if (myBet === BigInt(0) && opponentBet === BigInt(0)) {
      // No bets yet - initial bet minimum is 1 XLM
      minRaiseStroops = BigInt(10000000);
    } else {
      // There's a bet to raise - min raise is opponent_bet + max(last_raise_amount, opponent_bet)
      const minRaiseIncrement = lastRaiseAmount > BigInt(0) ? lastRaiseAmount : opponentBet;
      minRaiseStroops = opponentBet + minRaiseIncrement;
    }
    
    const minBetValue = Number(minRaiseStroops) / 10000000;
    setBetAmount(minBetValue);
    setShowRaiseSlider(true);
  };

  const handleRaiseConfirm = async () => {
    try {
      if (!gameState) return;
      
      const isPlayer1 = gameState.player1 === publicKey;
      const myBet = isPlayer1 ? gameState.player1_bet : gameState.player2_bet;
      const opponentBet = isPlayer1 ? gameState.player2_bet : gameState.player1_bet;
      
      console.log('[handleRaiseConfirm] betAmount:', betAmount);
      console.log('[handleRaiseConfirm] myBet:', myBet, 'opponentBet:', opponentBet);
      
      // Convert XLM to stroops (1 XLM = 10,000,000 stroops)
      const amountInStroops = BigInt(Math.round(betAmount * 10000000));
      
      console.log('[handleRaiseConfirm] amountInStroops:', amountInStroops);
      
      toast.loading(`${myBet === BigInt(0) && opponentBet === BigInt(0) ? 'Betting' : 'Raising to'} ${betAmount.toFixed(2)} XLM...`);
      
      const { PockerService } = await import("../games/pocker/pockerService");
      const { POCKER_CONTRACT } = await import("../utils/constants");
      const signer = getContractSigner();
      
      const pockerService = new PockerService(POCKER_CONTRACT);
      
      // Use Bet action if both players have 0 bets, otherwise use Raise
      const action = myBet === BigInt(0) && opponentBet === BigInt(0)
        ? { tag: "Bet" as const, values: [amountInStroops] as const }
        : { tag: "Raise" as const, values: [amountInStroops] as const };
      
      console.log('[handleRaiseConfirm] action:', action);
      
      await pockerService.playerAction(
        sessionId,
        publicKey!,
        action,
        signer
      );
      
      toast.dismiss();
      toast.success(`${action.tag === "Bet" ? 'Bet' : 'Raised to'} ${betAmount.toFixed(2)} XLM!`);
      setShowRaiseSlider(false);
      
      // Reload game state
      await new Promise(resolve => setTimeout(resolve, 2000));
      await loadGameState();
      
    } catch (err: any) {
      toast.dismiss();
      console.error("[GameScreen] Error raising:", err);
      toast.error(err.message || "Failed to raise");
      setShowRaiseSlider(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header showBackButton onBack={onBack} />
        <div className="w-full min-h-screen flex items-center justify-center pt-20">
          <div className="bg-black/50 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-12 text-center max-w-md">
            <div className="text-white text-2xl mb-4">Loading game...</div>
            <div className="text-white/70 text-sm mb-4">
              Session ID: {sessionId || "Not set"}
            </div>
            <div className="text-white/50 text-xs mb-4">
              Waiting for the blockchain to index the transaction.
              This usually takes 5-15 seconds.
            </div>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!gameState) {
    return (
      <>
        <Header showBackButton onBack={onBack} />
        <div className="w-full min-h-screen flex flex-col items-center justify-center pt-20 p-4">
          <div className="bg-black/50 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-12 text-center max-w-md">
            <div className="text-white text-2xl mb-4">Waiting for game...</div>
            <div className="text-white/70 text-sm mb-4">
              Session ID: {sessionId || "Not set"}
            </div>
            <div className="text-white/50 text-xs">
              The game contract is being created. This may take a few moments.
            </div>
          </div>
        </div>
      </>
    );
  }

  const isPlayer1 = gameState.player1 === publicKey;
  const myCommitted = isPlayer1 
    ? gameState.player1_hole_commitment !== null 
    : gameState.player2_hole_commitment !== null;
  const opponentCommitted = isPlayer1 
    ? gameState.player2_hole_commitment !== null 
    : gameState.player1_hole_commitment !== null;
  const bothCommitted = myCommitted && opponentCommitted;
  const hasWinner = gameState.winner !== null && gameState.winner !== undefined;
  
  const phase = gameState.phase?.tag || "Commit";
  const isCommitPhase = phase === "Commit";
  const isBettingPhase = phase === "Preflop" || phase === "Flop" || phase === "Turn" || phase === "River";
  const isShowdownPhase = phase === "Showdown";
  const isComplete = phase === "Complete" || hasWinner;
  
  // Check if it's my turn
  const playerIndex = isPlayer1 ? 0 : 1;
  const isMyTurn = Number(gameState.current_actor) === playerIndex;
  
  console.log('[GameScreen] Turn info:', {
    current_actor: gameState.current_actor,
    playerIndex,
    isMyTurn,
    isPlayer1,
    phase
  });
  
  // Get betting info
  const myStack = isPlayer1 ? gameState.player1_stack : gameState.player2_stack;
  const myBet = isPlayer1 ? gameState.player1_bet : gameState.player2_bet;
  const opponentBet = isPlayer1 ? gameState.player2_bet : gameState.player1_bet;
  const lastRaiseAmount = gameState.last_raise_amount || BigInt(0);
  const potAmount = gameState.pot ? Number(gameState.pot) / 10000000 : 0;
  const myStackXLM = myStack ? Number(myStack) / 10000000 : 0;
  const myBetXLM = myBet ? Number(myBet) / 10000000 : 0;
  const opponentBetXLM = opponentBet ? Number(opponentBet) / 10000000 : 0;
  
  // Can check if no bet to call
  const canCheck = opponentBet === myBet;
  const needsToCall = opponentBet > myBet;
  
  // Calculate min/max raise amounts using proper no-limit poker logic
  // For initial bet: min is 1 XLM (10,000,000 stroops)
  // For raise: min is opponent_bet + last_raise_amount (or opponent_bet if last_raise_amount is 0)
  let minRaiseStroops: bigint;
  if (myBet === BigInt(0) && opponentBet === BigInt(0)) {
    // No bets yet - initial bet minimum is 1 XLM
    minRaiseStroops = BigInt(10000000);
  } else {
    // There's a bet to raise - min raise is opponent_bet + max(last_raise_amount, opponent_bet)
    const minRaiseIncrement = lastRaiseAmount > BigInt(0) ? lastRaiseAmount : opponentBet;
    minRaiseStroops = opponentBet + minRaiseIncrement;
  }
  const minBet = Number(minRaiseStroops) / 10000000;
  const maxBet = myStackXLM + myBetXLM; // Can bet up to stack + current bet

  return (
    <>
      <Header 
        showBackButton={false} 
        potAmount={potAmount}
        phase={phase}
      />
      
      <PokerTable>
        <CommunityCards 
          phase={phase}
          communityCards={gameState.community_cards || []}
        />

        <PlayerCardArea
          label="Opponent"
          cards={[]}
          showCards={false}
          position="top"
        />

        <PlayerCardArea
          label="You"
          cards={myCards}
          showCards={true}
          position="bottom"
        />
      </PokerTable>

      <GameControls
        myCommitted={myCommitted}
        bothCommitted={bothCommitted}
        isCommitPhase={isCommitPhase}
        isBettingPhase={isBettingPhase}
        isShowdownPhase={isShowdownPhase}
        isComplete={isComplete}
        isMyTurn={isMyTurn}
        canCheck={canCheck}
        needsToCall={needsToCall}
        generatingProof={generatingProof}
        isCommitting={isCommitting}
        isRevealing={isRevealing}
        showRaiseSlider={showRaiseSlider}
        betAmount={betAmount}
        minBet={minBet}
        maxBet={maxBet}
        myStackXLM={myStackXLM}
        myBetXLM={myBetXLM}
        opponentBetXLM={opponentBetXLM}
        potAmount={potAmount}
        phase={phase}
        winner={gameState.winner}
        publicKey={publicKey!}
        onCommit={handleCommit}
        onFold={handleFold}
        onCall={handleCall}
        onCheck={handleCheck}
        onRaise={handleRaise}
        onReveal={handleReveal}
        onBack={onBack}
        setBetAmount={setBetAmount}
        setShowRaiseSlider={setShowRaiseSlider}
        onRaiseConfirm={handleRaiseConfirm}
      />
    </>
  );
}
