interface PotDisplayProps {
  amount: number;
}

export function PotDisplay({ amount }: PotDisplayProps) {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
      <div className="text-white/70 text-sm mb-2">POT</div>
      <div className="text-white text-4xl font-bold drop-shadow-lg">
        ${amount}
      </div>
    </div>
  );
}
