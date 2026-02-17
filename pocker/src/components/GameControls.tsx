import GlossyButton from "./GlossyButton";
import GlossySlider from "./GlossySlider";

interface GameControlsProps {
  myCommitted: boolean;
  isRevealPhase: boolean;
  isComplete: boolean;
  generatingProof: boolean;
  showRaiseSlider: boolean;
  betAmount: number;
  minBet: number;
  maxBet: number;
  winner: string | null;
  publicKey: string;
  onCommit: () => void;
  onFold: () => void;
  onCall: () => void;
  onRaise: () => void;
  onReveal: () => void;
  onBack: () => void;
  setBetAmount: (amount: number) => void;
  setShowRaiseSlider: (show: boolean) => void;
  onRaiseConfirm: () => void;
}

export function GameControls({
  myCommitted,
  isRevealPhase,
  isComplete,
  generatingProof,
  showRaiseSlider,
  betAmount,
  minBet,
  maxBet,
  winner,
  publicKey,
  onCommit,
  onFold,
  onCall,
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
                  Click below to generate your hand and commit to the blockchain
                </div>
                <GlossyButton 
                  onClick={onCommit} 
                  className="w-full py-4 text-xl bg-green-600 hover:bg-green-700"
                >
                  Generate Hand & Commit
                </GlossyButton>
              </div>
            )}

            {/* Committed - Show Play Buttons (Fold/Call/Raise) */}
            {myCommitted && !isRevealPhase && !isComplete && (
              <div className="flex gap-4">
                <GlossyButton 
                  onClick={onFold}
                  className="flex-1 py-4 text-xl bg-gray-600 hover:bg-gray-700"
                >
                  Fold
                </GlossyButton>
                <GlossyButton 
                  onClick={onCall}
                  className="flex-1 py-4 text-xl bg-blue-600 hover:bg-blue-700"
                >
                  Call
                </GlossyButton>
                <GlossyButton 
                  onClick={onRaise}
                  className="flex-1 py-4 text-xl bg-red-600 hover:bg-red-700"
                >
                  Raise
                </GlossyButton>
              </div>
            )}

            {/* Reveal Phase - Show Reveal Button */}
            {isRevealPhase && !isComplete && (
              <div className="flex flex-col gap-4">
                <div className="text-center text-white/70 text-sm mb-2">
                  Both players have committed. Generate ZK proof to reveal winner.
                </div>
                <GlossyButton 
                  onClick={onReveal}
                  className="w-full py-4 text-xl bg-purple-600 hover:bg-purple-700"
                  disabled={generatingProof}
                >
                  {generatingProof ? "Generating Proof..." : "Reveal Winner"}
                </GlossyButton>
              </div>
            )}

            {/* Complete - Show Winner */}
            {isComplete && (
              <div className="flex flex-col gap-4">
                <div className="text-center bg-green-500/20 border-2 border-green-500/50 rounded-xl p-4">
                  <div className="text-green-200 text-2xl font-bold">
                    {winner === publicKey ? "You Won!" : "Opponent Won"}
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
