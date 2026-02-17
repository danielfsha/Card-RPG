import { useState, useEffect } from "react";
import { useGameEngine } from "../hooks/useGameEngine";
import { useWallet } from "../hooks/useWallet";
import Header from "../components/Header";
import GlossyButton from "../components/GlossyButton";
import GlossySlider from "../components/GlossySlider";
import toast from "react-hot-toast";
import { ZKPokerService } from "../services/zkService";
import cardsData from "../../public/cards.json";

interface GameScreenProps {
  onBack: () => void;
}

interface CardData {
  rank: string;
  suit: string;
  display: string;
  color: string;
  image: string;
}

export function GameScreen({ onBack }: GameScreenProps) {
  const { sessionId, players } = useGameEngine();
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
  useEffect(() => {
    if (!sessionId || sessionId === 0) {
      console.warn("[GameScreen] Invalid session ID:", sessionId);
      setLoading(false);
      return;
    }

    let pollCount = 0;
    const MAX_POLLS = 30;
    let pollInterval: NodeJS.Timeout;
    
    const loadGame = async () => {
      try {
        pollCount++;
        console.log("[GameScreen] Loading game for session:", sessionId, `(poll ${pollCount}/${MAX_POLLS})`);
        
        const { PockerService } = await import("../games/pocker/pockerService");
        const { POCKER_CONTRACT } = await import("../utils/constants");
        
        const pockerService = new PockerService(POCKER_CONTRACT);
        const game = await pockerService.getGame(sessionId);
        
        if (game) {
          console.log("[GameScreen] ✅ Game loaded successfully:", game);
          setGameState(game);
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
      } catch (err) {
        console.error("[GameScreen] Error loading game:", err);
        if (pollCount >= MAX_POLLS) {
          toast.error("Failed to load game after multiple attempts");
          setLoading(false);
          if (pollInterval) clearInterval(pollInterval);
        }
      }
    };

    loadGame();
    pollInterval = setInterval(loadGame, 3000);
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [sessionId]);

  // Get card display info
  const getCardInfo = (cardIndex: number): CardData | null => {
    const card = cardsData.cards[cardIndex.toString() as keyof typeof cardsData.cards];
    return card || null;
  };

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
        const info = getCardInfo(c);
        return info ? info.display : `Card ${c}`;
      }).join(" ");
      toast.success(`Your hand: ${cardNames}`, { duration: 5000 });
      
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

  // Render playing card
  const renderCard = (cardIndex: number, index: number) => {
    const cardInfo = getCardInfo(cardIndex);
    if (!cardInfo) return null;

    return (
      <div
        key={index}
        className="relative w-24 h-32 transition-transform hover:scale-105 hover:-translate-y-2"
        style={{
          marginLeft: index > 0 ? '-20px' : '0',
          filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))',
        }}
      >
        <img 
          src={cardInfo.image} 
          alt={cardInfo.display}
          className="w-full h-full object-contain"
        />
      </div>
    );
  };

  // Render card back
  const renderCardBack = (index: number) => {
    return (
      <div
        key={index}
        className="relative w-24 h-32"
        style={{
          marginLeft: index > 0 ? '-20px' : '0',
          filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))',
        }}
      >
        <img 
          src={cardsData.cardBack} 
          alt="Card back"
          className="w-full h-full object-contain"
        />
      </div>
    );
  };

  return (
    <>
      <Header showBackButton={false} />
      
      {/* Poker Table */}
      <div className="w-full min-h-screen flex items-center justify-center p-4 pt-20 pb-32"
        style={{
          background: 'linear-gradient(180deg, #1a472a 0%, #0d2818 100%)',
        }}
      >
        <div className="relative w-full max-w-6xl aspect-[16/10]">
          {/* Poker Table Ellipse */}
          <div 
            className="absolute inset-0 rounded-[50%] border-8 shadow-2xl"
            style={{
              background: 'radial-gradient(ellipse at center, #2d5a3d 0%, #1a3d2a 100%)',
              borderColor: '#8b4513',
              boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5), 0 20px 40px rgba(0,0,0,0.6)',
            }}
          >
            {/* Table felt texture */}
            <div className="absolute inset-8 rounded-[50%] opacity-20"
              style={{
                background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
              }}
            />
          </div>

          {/* Center Pot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <div className="text-white/70 text-sm mb-2">POT</div>
            <div className="text-white text-4xl font-bold drop-shadow-lg">
              ${gameState.player1_points ? Number(gameState.player1_points) / 10000000 : 0}
            </div>
          </div>

          {/* Opponent's Area (Top) */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <div className="text-white/70 text-sm mb-2">Opponent</div>
            {opponentCommitted ? (
              <div className="flex">
                {[0, 1, 2, 3, 4].map((i) => renderCardBack(i))}
              </div>
            ) : (
              <div className="text-white/50 text-sm">Waiting to commit...</div>
            )}
          </div>

          {/* Player's Area (Bottom) */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <div className="text-white/70 text-sm mb-2">You</div>
            {myCards.length > 0 ? (
              <div className="flex">
                {myCards.map((card, index) => renderCard(card, index))}
              </div>
            ) : (
              <div className="text-white/50 text-sm">No cards yet - Click "Generate & Commit"</div>
            )}
          </div>

          {/* Phase Indicator */}
          <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20">
            <div className="text-white/70 text-xs">Phase</div>
            <div className="text-white text-lg font-bold">{phase}</div>
          </div>

          {/* Session ID */}
          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20">
            <div className="text-white/70 text-xs">Session</div>
            <div className="text-white text-sm font-mono">{sessionId}</div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Controls Container */}
      <div 
        className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent backdrop-blur-sm border-t border-white/10 p-6"
        style={{ pointerEvents: 'none' }}
      >
        <div className="max-w-4xl mx-auto" style={{ pointerEvents: 'auto' }}>
          {/* Raise Slider */}
          {showRaiseSlider && (
            <div className="mb-4">
              <GlossySlider
                value={betAmount}
                min={minBet}
                max={maxBet}
                onChange={setBetAmount}
                onBackClick={() => setShowRaiseSlider(false)}
                onOkClick={handleRaiseConfirm}
                formatValue={(val) => `$${val}`}
                showBackButton={true}
                showOkButton={true}
              />
            </div>
          )}

          {/* Action Buttons */}
          {!showRaiseSlider && (
            <>
              {/* Commit Phase */}
              {isCommitPhase && !isComplete && !myCommitted && (
                <div className="flex flex-col gap-2">
                  <div className="text-center text-white/70 text-sm mb-2">
                    Click below to generate your hand and commit to the blockchain
                  </div>
                  <GlossyButton 
                    onClick={handleCommit} 
                    className="w-full py-4 text-xl bg-green-600 hover:bg-green-700"
                  >
                    🎴 Generate Hand & Commit
                  </GlossyButton>
                </div>
              )}

              {/* Waiting for opponent */}
              {isCommitPhase && myCommitted && !bothCommitted && (
                <div className="text-center text-white/70 py-4">
                  Waiting for opponent to commit...
                </div>
              )}

              {/* Reveal Phase */}
              {isRevealPhase && !isComplete && (
                <div className="flex gap-4">
                  <GlossyButton 
                    onClick={handleFold}
                    className="flex-1 py-4 text-xl bg-gray-600 hover:bg-gray-700"
                  >
                    Fold
                  </GlossyButton>
                  <GlossyButton 
                    onClick={handleCall}
                    className="flex-1 py-4 text-xl bg-blue-600 hover:bg-blue-700"
                  >
                    Call
                  </GlossyButton>
                  <GlossyButton 
                    onClick={handleRaise}
                    className="flex-1 py-4 text-xl bg-red-600 hover:bg-red-700"
                  >
                    Raise
                  </GlossyButton>
                </div>
              )}

              {/* Complete - Show Winner */}
              {isComplete && (
                <div className="flex flex-col gap-4">
                  <div className="text-center bg-green-500/20 border-2 border-green-500/50 rounded-xl p-4">
                    <div className="text-green-200 text-2xl font-bold">
                      {gameState.winner === publicKey ? "You Won!" : "Opponent Won"}
                    </div>
                  </div>
                  <GlossyButton 
                    onClick={onBack}
                    className="w-full py-4 text-xl"
                  >
                    Back to Lobby
                  </GlossyButton>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
