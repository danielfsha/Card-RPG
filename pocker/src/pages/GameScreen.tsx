import { useState, useEffect } from "react";
import { useGameEngine } from "../hooks/useGameEngine";
import { useWallet } from "../hooks/useWallet";
import Header from "../components/Header";
import { PokerTable } from "../components/PokerTable";
import { PotDisplay } from "../components/PotDisplay";
import { PlayerCardArea } from "../components/PlayerCardArea";
import { GameControls } from "../components/GameControls";
import { GameInfo } from "../components/GameInfo";
import toast from "react-hot-toast";
import { ZKPokerService } from "../services/zkService";
import cardsData from "../../public/cards.json";

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
  
  // Betting state
  const [betAmount, setBetAmount] = useState(1);
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);
  const minBet = 1;
  const maxBet = 100;

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

  // Commit Phase: Generate hand and submit commitment
  const handleCommit = async () => {
    try {
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
      await pockerService.submitCommitment(
        sessionId,
        publicKey!,
        commitment,
        signer
      );
      
      toast.success("Commitment submitted!");
      
      const cardNames = cards.map(c => {
        const info = cardsData.cards[c.toString() as keyof typeof cardsData.cards];
        return info ? info.display : `Card ${c}`;
      }).join(" ");
      toast.success(`Your hand: ${cardNames}`, { duration: 5000 });
      
      // Reload game state to update myCommitted flag
      console.log("[GameScreen] Reloading game state after commit...");
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for blockchain
      await loadGameState();
      
    } catch (err: any) {
      toast.dismiss();
      console.error("[GameScreen] Error committing:", err);
      toast.error(err.message || "Failed to commit hand");
    }
  };

  // Reveal Phase: Generate and submit ZK proof
  const handleReveal = async () => {
    try {
      setGeneratingProof(true);
      toast.loading("Generating ZK proof... This may take a few seconds.");
      
      const opponentCards = zkService.generateRandomHand();
      const opponentSalt = zkService.generateSalt();
      const opponentCommitment = await zkService.commitHand(opponentCards, opponentSalt);
      
      const isPlayer1 = gameState.player1 === publicKey;
      const player1Cards = isPlayer1 ? myCards : opponentCards;
      const player1Salt = isPlayer1 ? mySalt! : opponentSalt;
      const player1Commitment = isPlayer1 ? myCommitment! : opponentCommitment;
      const player2Cards = isPlayer1 ? opponentCards : myCards;
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
    }
  };

  const handleFold = () => {
    toast("Fold functionality coming soon!");
  };

  const handleCall = () => {
    toast("Call functionality coming soon!");
  };

  const handleRaise = () => {
    setShowRaiseSlider(true);
  };

  const handleRaiseConfirm = () => {
    toast.success(`Raised ${betAmount} XLM!`);
    setShowRaiseSlider(false);
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
    ? gameState.player1_commitment !== null 
    : gameState.player2_commitment !== null;
  const opponentCommitted = isPlayer1 
    ? gameState.player2_commitment !== null 
    : gameState.player1_commitment !== null;
  const bothCommitted = myCommitted && opponentCommitted;
  const hasWinner = gameState.winner !== null && gameState.winner !== undefined;
  
  const phase = gameState.phase?.tag || "Commit";
  const isCommitPhase = phase === "Commit";
  const isRevealPhase = phase === "Reveal";
  const isComplete = phase === "Complete" || hasWinner;

  const potAmount = gameState.player1_points ? Number(gameState.player1_points) / 10000000 : 0;

  return (
    <>
      <Header showBackButton={false} />
      
      <PokerTable>
        <PotDisplay
          amount={potAmount}
          myCommitted={myCommitted}
          opponentCommitted={opponentCommitted}
          bothCommitted={bothCommitted}
          isCommitPhase={isCommitPhase}
          isRevealPhase={isRevealPhase}
          isComplete={isComplete}
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

        {/* <GameInfo phase={phase} sessionId={sessionId} /> */}
      </PokerTable>

      <GameControls
        myCommitted={myCommitted}
        isRevealPhase={isRevealPhase}
        isComplete={isComplete}
        generatingProof={generatingProof}
        showRaiseSlider={showRaiseSlider}
        betAmount={betAmount}
        minBet={minBet}
        maxBet={maxBet}
        winner={gameState.winner}
        publicKey={publicKey!}
        onCommit={handleCommit}
        onFold={handleFold}
        onCall={handleCall}
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
