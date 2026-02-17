import { useWallet } from "../hooks/useWallet";
import { WalletModal } from "./WalletModal";

interface HeaderProps {
  onBack?: () => void;
  showBackButton?: boolean;
}

export default function Header({ onBack, showBackButton = false }: HeaderProps) {
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

      {publicKey && <WalletModal />}
    </header>
  );
}
