import { useWallet } from "../hooks/useWallet";
import { WalletModal } from "./WalletModal";

interface HeaderProps {
  onBack?: () => void;
  showBackButton?: boolean;
  potAmount?: number;
  phase?: string;
}

export default function Header({ onBack, showBackButton = false, potAmount, phase }: HeaderProps) {
  const { publicKey } = useWallet();

  return (
    <header className="flex items-center justify-between p-4 fixed top-0 left-0 w-screen z-50">
      <div className="flex items-center gap-4">
        {showBackButton && onBack && (
          <button
            onClick={onBack}
            className="text-white hover:text-white/80 transition-colors text-2xl"
            title="Go back"
          >
            ←
          </button>
        )}
        <img src="/logo.png" className="h-12" alt="Logo" />
      </div>

      {/* Pot Display in Header */}
      {potAmount !== undefined && (
        <div className="absolute left-1/2 -translate-x-1/2 text-center">
          <div className="text-white/70 text-xs mb-1">{phase || "POT"}</div>
          <div className="text-white text-2xl font-bold drop-shadow-lg">
            {potAmount.toFixed(2)} XLM
          </div>
        </div>
      )}

      {publicKey && <WalletModal />}
    </header>
  );
}
