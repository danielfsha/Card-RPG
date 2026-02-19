interface GameInfoProps {
  phase: string;
  sessionId: number;
}

export function GameInfo({ phase, sessionId }: GameInfoProps) {
  return (
    <>
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
    </>
  );
}
