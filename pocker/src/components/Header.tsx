import { useWallet } from "../hooks/useWallet";
import GlossyButton from "./GlossyButton";

interface HeaderProps {
  onBack?: () => void;
  showBackButton?: boolean;
}

export default function Header({ onBack, showBackButton = false }: HeaderProps) {
  const { publicKey, disconnect } = useWallet();

  const truncateAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <header className="flex items-center justify-between p-4 fixed top-0 left-0 w-screen bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm z-50">
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

      {publicKey && (
        <div className="flex items-center gap-3">
          <GlossyButton className="px-4 py-2">
            {truncateAddress(publicKey)}
          </GlossyButton>
          <button
            onClick={disconnect}
            className="text-white/70 hover:text-white text-sm transition-colors"
          >
            Disconnect
          </button>
        </div>
      )}
    </header>
  );
}
