import { useState, useEffect } from "react";
import { useGameEngine } from "../hooks/useGameEngine";
import { useWallet } from "../hooks/useWallet";
import Header from "../components/Header";
import GlossyButton from "../components/GlossyButton";
import toast from "react-hot-toast";
import { ZKPokerService } from "../services/zkService";

interface GameScreenProps {
  onBack: () => void;
}

export function GameScreen({ onBack }: GameScreenProps) {
  const { sessionId, players } = useGameEngine();
  const { publicKey } = useWallet();
  const [gameState, setGameState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // ZK state
  const [zkService] = useState(() => new ZKPokerService());
  const [myCards, setMyCards] = useState<number[]>([]);
  const [mySalt, setMySalt] = useState<bigint>();
  const [myCommitment, setMyCommitment] = useState<string>();
  const [generatingProof, setGeneratingProof] = useState(false);

  // Load game state
  useEffect(() => {
    let pollCount = 0;
    const MAX_POLLS = 20; // 20 polls * 3 seconds = 60 seconds max wait
    
    const loadGame = async () => {
      try {
        console.log("[GameScreen] Loading game for session:", sessionId, `(poll ${pollCount + 1}/${MAX_POLLS})`);
        
        const { PockerService } = await import("../games/pocker/pockerService");
        const { POCKER_CONTRACT } = await import("../utils/constants");
        
        const pockerService = new PockerService(POCKER_CONTRACT);
        const game = await pockerService.getGame(sessionId);
        
        if (game) {
          console.log("[GameScreen] Game loaded:", game);
          setGameState(game);
          setLoading(false);
        } else {
          pollCount++;
          if (pollCount >= MAX_POLLS) {
            console.error("[GameScreen] Game not found after maximum polling attempts");
            toast.error("Game not found. The transaction may have failed.");
            setLoading(false);
          } else {
            console.warn("[GameScreen] Game not found yet, will retry...");
          }
        }
      } catch (err) {
        console.error("[GameScreen] Error loading game:", err);
        pollCount++;
        if (pollCount >= MAX_POLLS) {
          toast.error("Failed to load game after multiple attempts");
          setLoading(false);
        }
      }
    };

    if (sessionId && sessionId !== 0) {
      loadGame();
      // Poll for updates every 3 seconds
      const interval = setInterval(loadGame, 3000);
      return () => clearInterval(interval);
    } else {
      console.warn("[GameScreen] Invalid session ID:", sessionId);
      setLoading(false);
    }
  }, [sessionId]);

  // Commit Phase: Generate hand and submit commitment
  const handleCommit = async () => {
    try {
      toast.loading("Generating hand and commitment...");
      
      // Generate random hand
      const cards = zkService.generateRandomHand();
      const salt = zkService.generateSalt();
      
      // Compute commitment
      await zkService.initialize();
      const commitment = await zkService.commitHand(cards, salt);
      
      // Store locally
      setMyCards(cards);
      setMySalt(salt);
      setMyCommitment(commitment);
      
      toast.dismiss();
      toast.success("Hand generated! Submitting commitment...");
      
      // Submit to contract
      const { PockerService } = await import("../games/pocker/pockerService");
      const { POCKER_CONTRACT } = await import("../utils/constants");
      const signer = useWallet().getContractSigner();
      
      const pockerService = new PockerService(POCKER_CONTRACT);
      await pockerService.submitCommitment(
        sessionId,
        publicKey!,
        commitment,
        signer
      );
      
      toast.success("Commitment submitted!");
      
      // Show cards to player
      const cardNames = cards.map(c => zkService.getCardName(c)).join(", ");
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
      
      // Get opponent's data (in real game, this would be exchanged off-chain)
      // For now, we'll generate a dummy opponent hand for testing
      const opponentCards = zkService.generateRandomHand();
      const opponentSalt = zkService.generateSalt();
      const opponentCommitment = await zkService.commitHand(opponentCards, opponentSalt);
      
      // Determine player order
      const isPlayer1 = gameState.player1 === publicKey;
      const player1Cards = isPlayer1 ? myCards : opponentCards;
      const player1Salt = isPlayer1 ? mySalt! : opponentSalt;
      const player1Commitment = isPlayer1 ? myCommitment! : opponentCommitment;
      const player2Cards = isPlayer1 ? opponentCards : myCards;
      const player2Salt = isPlayer1 ? opponentSalt : mySalt!;
      const player2Commitment = isPlayer1 ? opponentCommitment : myCommitment!;
      
      // Generate proof
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
      
      // Serialize proof for contract
      const serializedProof = zkService.serializeProof(proofData.proof);
      
      // Serialize public signals as Buffers
      const publicSignalsBuffers = proofData.publicSignals.map((signal: string) => {
        const bn = BigInt(signal);
        const hex = bn.toString(16).padStart(64, '0');
        return Buffer.from(hex, 'hex');
      });
      
      // Submit to contract
      const { PockerService } = await import("../games/pocker/pockerService");
      const { POCKER_CONTRACT } = await import("../utils/constants");
      const signer = useWallet().getContractSigner();
      
      const pockerService = new PockerService(POCKER_CONTRACT);
      await pockerService.revealWinner(
        sessionId,
        publicKey!,
        serializedProof,
        publicSignalsBuffers,
        signer
      );
      
      toast.success("Winner revealed!");
      
      // Show results
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

  if (loading) {
    return (
      <>
        <Header showBackButton onBack={onBack} />
        <div className="w-full min-h-screen flex items-center justify-center pt-20">
          <div className="text-white text-2xl">Loading game...</div>
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

  // Determine game phase and player status
  const isPlayer1 = gameState.player1 === publicKey;
  const myCommitted = isPlayer1 
    ? gameState.player1_commitment !== null 
    : gameState.player2_commitment !== null;
  const opponentCommitted = isPlayer1 
    ? gameState.player2_commitment !== null 
    : gameState.player1_commitment !== null;
  const bothCommitted = myCommitted && opponentCommitted;
  const hasWinner = gameState.winner !== null && gameState.winner !== undefined;
  
  // Phase display
  const phase = gameState.phase?.tag || "Commit";
  const isCommitPhase = phase === "Commit";
  const isRevealPhase = phase === "Reveal";
  const isComplete = phase === "Complete" || hasWinner;

  return (
    <>
      <Header showBackButton onBack={onBack} />
      <div className="w-full min-h-screen flex flex-col items-center justify-center p-4 pt-24">
        <div className="bg-black/50 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-12 w-full max-w-4xl">
          <h2 className="text-white text-4xl mb-8 text-center font-bold">
            ZK POKER
          </h2>

          {/* Game Info */}
          <div className="mb-8 grid grid-cols-3 gap-4">
            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
              <div className="text-white/70 text-sm mb-2">Session ID</div>
              <div className="text-white text-xl font-mono">{sessionId}</div>
            </div>
            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
              <div className="text-white/70 text-sm mb-2">Phase</div>
              <div className="text-white text-xl">{phase}</div>
            </div>
            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
              <div className="text-white/70 text-sm mb-2">Players</div>
              <div className="text-white text-xl">{players.length}/2</div>
            </div>
          </div>

          {/* Game Complete */}
          {isComplete && (
            <div className="mb-8 bg-green-500/20 border-2 border-green-500/50 rounded-xl p-6">
              <div className="text-center">
                <div className="text-green-200 text-2xl font-bold mb-2">
                  Game Complete!
                </div>
                <div className="text-green-200 text-lg">
                  Winner: {gameState.winner === publicKey ? "You!" : "Opponent"}
                </div>
                {gameState.player1_ranking !== null && (
                  <div className="text-green-200 text-sm mt-4">
                    <div>Player 1: {zkService.getHandRankingName(gameState.player1_ranking)}</div>
                    <div>Player 2: {zkService.getHandRankingName(gameState.player2_ranking)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Commit Phase */}
          {isCommitPhase && !isComplete && (
            <>
              <div className="mb-8 bg-blue-500/20 border-2 border-blue-500/50 rounded-xl p-6">
                <div className="text-center">
                  <div className="text-blue-200 text-xl font-bold mb-4">
                    Commitment Phase
                  </div>
                  <div className="text-blue-200 text-sm mb-4">
                    {!myCommitted && "Generate your hand and submit commitment"}
                    {myCommitted && !bothCommitted && "Waiting for opponent to commit..."}
                    {bothCommitted && "Both players committed! Moving to reveal phase..."}
                  </div>
                </div>
              </div>

              {/* Commitment Status */}
              <div className="mb-8 grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                  <div className="text-white/70 text-sm mb-2">Your Commitment</div>
                  <div className="text-white text-3xl font-bold">
                    {myCommitted ? "✓" : "—"}
                  </div>
                  {myCards.length > 0 && (
                    <div className="text-white/70 text-xs mt-2">
                      {myCards.map(c => zkService.getCardName(c)).join(", ")}
                    </div>
                  )}
                </div>
                <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                  <div className="text-white/70 text-sm mb-2">Opponent's Commitment</div>
                  <div className="text-white text-3xl font-bold">
                    {opponentCommitted ? "✓" : "—"}
                  </div>
                </div>
              </div>

              {/* Commit Button */}
              {!myCommitted && (
                <GlossyButton onClick={handleCommit} className="w-full py-4 text-xl">
                  Generate Hand & Commit
                </GlossyButton>
              )}
            </>
          )}

          {/* Reveal Phase */}
          {isRevealPhase && !isComplete && (
            <>
              <div className="mb-8 bg-purple-500/20 border-2 border-purple-500/50 rounded-xl p-6">
                <div className="text-center">
                  <div className="text-purple-200 text-xl font-bold mb-4">
                    Reveal Phase
                  </div>
                  <div className="text-purple-200 text-sm mb-4">
                    Generate ZK proof to reveal the winner
                  </div>
                </div>
              </div>

              {/* Your Hand */}
              {myCards.length > 0 && (
                <div className="mb-8 bg-white/5 p-6 rounded-xl border border-white/10">
                  <div className="text-white/70 text-sm mb-2">Your Hand</div>
                  <div className="text-white text-2xl">
                    {myCards.map(c => zkService.getCardName(c)).join("  ")}
                  </div>
                </div>
              )}

              {/* Reveal Button */}
              <GlossyButton 
                onClick={handleReveal} 
                className="w-full py-4 text-xl"
                disabled={generatingProof}
              >
                {generatingProof ? "Generating Proof..." : "Reveal Winner (Generate ZK Proof)"}
              </GlossyButton>
            </>
          )}

          {/* Back Button */}
          {isComplete && (
            <div className="mt-8">
              <GlossyButton onClick={onBack} className="w-full py-3">
                Back to Lobby
              </GlossyButton>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
