import GlossyButton from "./GlossyButton";
import GlossySlider from "./GlossySlider";

interface GameControlsProps {
  myCommitted: boolean;
  bothCommitted: boolean;
  isCommitPhase: boolean;
  isBettingPhase: boolean;
  isShowdownPhase: boolean;
  isComplete: boolean;
  isMyTurn: boolean;
  canCheck: boolean;
  needsToCall: boolean;
  generatingProof: boolean;
  isCommitting: boolean;
  isRevealing: boolean;
  showRaiseSlider: boolean;
  betAmount: number;
  minBet: number;
  maxBet: number;
  myStackXLM: number;
  myBetXLM: number;
  opponentBetXLM: number;
  potAmount: number;
  phase: string;
  winner: string | null;
  publicKey: string;
  onCommit: () => void;
  onFold: () => void;
  onCall: () => void;
  onCheck: () => void;
  onRaise: () => void;
  onReveal: () => void;
  onBack: () => void;
  setBetAmount: (amount: number) => void;
  setShowRaiseSlider: (show: boolean) => void;
  onRaiseConfirm: () => void;
}

export function GameControls({
  myCommitted,
  bothCommitted,
  isCommitPhase,
  isBettingPhase,
  isShowdownPhase,
  isComplete,
  isMyTurn,
  canCheck,
  needsToCall,
  generatingProof,
  isCommitting,
  isRevealing,
  showRaiseSlider,
  betAmount,
  minBet,
  maxBet,
  myStackXLM,
  myBetXLM,
  opponentBetXLM,
  potAmount,
  phase,
  winner,
  publicKey,
  onCommit,
  onFold,
  onCall,
  onCheck,
  onRaise,
  onReveal,
  onBack,
  setBetAmount,
  setShowRaiseSlider,
  onRaiseConfirm,
}: GameControlsProps) {
  return (
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
              onOkClick={onRaiseConfirm}
              formatValue={(val) => `${val}`}
              showBackButton={true}
              showOkButton={true}
            />
          </div>
        )}

        {/* Action Buttons */}
        {!showRaiseSlider && (
          <>
            {/* Not Committed Yet - Show Generate & Commit Button */}
            {!myCommitted && !isComplete && (
              <div className="flex flex-col gap-2">
                <div className="text-center text-white/70 text-sm mb-2">
                  Click below to generate your 2 hole cards and commit to the blockchain
                </div>
                <GlossyButton 
                  onClick={onCommit} 
                  className="w-full py-4 text-xl bg-green-600 hover:bg-green-700"
                  disabled={isCommitting}
                >
                  {isCommitting ? "Committing..." : "Generate Hand & Commit"}
                </GlossyButton>
              </div>
            )}

            {/* Committed but waiting for opponent to commit */}
            {myCommitted && !bothCommitted && isCommitPhase && !isComplete && (
              <div className="flex flex-col gap-2">
                <div className="text-center text-white/70 text-sm py-8">
                  Waiting for opponent to commit their hand...
                </div>
              </div>
            )}

            {/* Betting Phase - Show Betting Buttons */}
            {myCommitted && isBettingPhase && !isComplete && (
              <div className="flex flex-col gap-3">
                {/* Game Info */}
                <div className="bg-black/50 rounded-lg p-3 text-white/80 text-sm">
                  <div className="flex justify-between mb-1">
                    <span>Phase: {phase}</span>
                    <span>Pot: {potAmount.toFixed(2)} XLM</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>Your Stack: {myStackXLM.toFixed(2)} XLM</span>
                    <span>Your Bet: {myBetXLM.toFixed(2)} XLM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Opponent Bet: {opponentBetXLM.toFixed(2)} XLM</span>
                    <span className={isMyTurn ? "text-green-400 font-bold" : "text-white/50"}>
                      {isMyTurn ? "YOUR TURN" : "Opponent's Turn"}
                    </span>
                  </div>
                </div>

                {/* Betting Actions */}
                {isMyTurn ? (
                  <div className="flex gap-2">
                    <GlossyButton 
                      onClick={onFold}
                      className="flex-1 py-3 text-lg bg-gray-600 hover:bg-gray-700"
                    >
                      Fold
                    </GlossyButton>
                    {canCheck ? (
                      <GlossyButton 
                        onClick={onCheck}
                        className="flex-1 py-3 text-lg bg-blue-600 hover:bg-blue-700"
                      >
                        Check
                      </GlossyButton>
                    ) : (
                      <GlossyButton 
                        onClick={onCall}
                        className="flex-1 py-3 text-lg bg-blue-600 hover:bg-blue-700"
                      >
                        Call {needsToCall ? `(${(opponentBetXLM - myBetXLM).toFixed(2)} XLM)` : ""}
                      </GlossyButton>
                    )}
                    <GlossyButton 
                      onClick={onRaise}
                      className="flex-1 py-3 text-lg bg-red-600 hover:bg-red-700"
                    >
                      Raise
                    </GlossyButton>
                  </div>
                ) : (
                  <div className="text-center text-white/70 py-3">
                    Waiting for opponent to act...
                  </div>
                )}
              </div>
            )}

            {/* Showdown Phase - Show Reveal Button */}
            {isShowdownPhase && !isComplete && (
              <div className="flex flex-col gap-4">
                <div className="text-center text-white/70 text-sm mb-2">
                  Betting complete. Generate ZK proof to reveal winner.
                </div>
                <GlossyButton 
                  onClick={onReveal}
                  className="w-full py-4 text-xl bg-purple-600 hover:bg-purple-700"
                  disabled={generatingProof || isRevealing}
                >
                  {generatingProof || isRevealing ? "Generating Proof..." : "Reveal Winner"}
                </GlossyButton>
              </div>
            )}

            {/* Complete - Show Winner and Pot Info */}
            {isComplete && (
              <div className="flex flex-col gap-4">
                <div className="text-center bg-green-500/20 border-2 border-green-500/50 rounded-xl p-4">
                  <div className="text-green-200 text-2xl font-bold mb-2">
                    {winner === publicKey ? "You Won!" : "Opponent Won"}
                  </div>
                  <div className="text-white/80 text-lg">
                    Pot: {potAmount.toFixed(2)} XLM
                  </div>
                  <div className="text-white/60 text-sm mt-2">
                    {winner === publicKey 
                      ? "The pot has been transferred to your account via Game Hub" 
                      : "Better luck next time!"}
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
  );
}
