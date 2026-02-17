interface PokerTableProps {
  children: React.ReactNode;
}

export function PokerTable({ children }: PokerTableProps) {
  return (
    <div
      className="w-full min-h-screen flex items-center justify-center p-8"
      style={{
        background: "linear-gradient(180deg, #1a472a 0%, #0d2818 100%)",
      }}
    >
      {children}
    </div>
  );
}
