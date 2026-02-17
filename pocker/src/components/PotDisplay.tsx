interface PotDisplayProps {
  amount: number;
  myCommitted: boolean;
  opponentCommitted: boolean;
  bothCommitted: boolean;
  isCommitPhase: boolean;
  isRevealPhase: boolean;
  isComplete: boolean;
}

export function PotDisplay({ 
  amount, 
  myCommitted, 
  opponentCommitted, 
  bothCommitted,
  isCommitPhase,
  isRevealPhase,
  isComplete 
}: PotDisplayProps) {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
      <div className="text-white/70 text-sm mb-2">POT</div>
      <div className="text-white text-4xl font-bold drop-shadow-lg">
        ${amount}
      </div>
      
      {/* Status Message */}
      <div className="mt-4 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20">
        {!myCommitted && (
          <div className="text-yellow-300 text-sm">Waiting for you to commit</div>
        )}
        {myCommitted && !opponentCommitted && (
          <div className="text-blue-300 text-sm">Waiting for opponent...</div>
        )}
        {bothCommitted && isCommitPhase && (
          <div className="text-green-300 text-sm">Both committed! Play your hand</div>
        )}
        {isRevealPhase && (
          <div className="text-purple-300 text-sm">Ready to reveal winner</div>
        )}
        {isComplete && (
          <div className="text-green-300 text-sm font-bold">Game Complete!</div>
        )}
      </div>
    </div>
  );
}
