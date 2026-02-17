import { useWallet } from "../hooks/useWallet";
import GlossyButton from "../components/GlossyButton";
import toast from "react-hot-toast";

interface SettingsScreenProps {
  onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { disconnect, publicKey } = useWallet();

  const truncatePublicKey = (key: string | null) => {
    if (!key) return "";
    return `${key.slice(0, 8)}...${key.slice(-8)}`;
  };

  const copyWalletAddress = () => {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey);
    toast.success("Wallet address copied!");
  };

  const handleDisconnect = () => {
    disconnect();
    toast.success("Wallet disconnected");
    onBack(); // This will trigger the redirect to splash screen
  };

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center p-4">
      <div className="bg-black/50 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-12 w-full max-w-md">
        <h3 className="text-white text-3xl mb-8 text-center font-bold">
          SETTINGS
        </h3>

        <div className="mb-8">
          <div className="text-white/70 text-sm mb-2">Connected Address:</div>
          <div className="flex items-center gap-2">
            <div className="text-white text-xl break-all flex-1">
              {truncatePublicKey(publicKey)}
            </div>
            <button
              onClick={copyWalletAddress}
              className="h-10 w-10 p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition-colors flex-shrink-0"
              title="Copy wallet address"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 512 512"
                className="fill-white"
              >
                <path d="M 416 336 L 224 336 L 416 336 L 224 336 Q 209 335 208 320 L 208 64 L 208 64 Q 209 49 224 48 L 364 48 L 364 48 L 432 116 L 432 116 L 432 320 L 432 320 Q 431 335 416 336 L 416 336 Z M 224 384 L 416 384 L 224 384 L 416 384 Q 443 383 461 365 Q 479 347 480 320 L 480 116 L 480 116 Q 480 96 466 82 L 398 14 L 398 14 Q 384 0 364 0 L 224 0 L 224 0 Q 197 1 179 19 Q 161 37 160 64 L 160 320 L 160 320 Q 161 347 179 365 Q 197 383 224 384 L 224 384 Z M 96 128 Q 69 129 51 147 L 51 147 L 51 147 Q 33 165 32 192 L 32 448 L 32 448 Q 33 475 51 493 Q 69 511 96 512 L 288 512 L 288 512 Q 315 511 333 493 Q 351 475 352 448 L 352 416 L 352 416 L 304 416 L 304 416 L 304 448 L 304 448 Q 303 463 288 464 L 96 464 L 96 464 Q 81 463 80 448 L 80 192 L 80 192 Q 81 177 96 176 L 128 176 L 128 176 L 128 128 L 128 128 L 96 128 L 96 128 Z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex flex-col space-y-4">
          <GlossyButton
            onClick={handleDisconnect}
            className="w-full"
          >
            Disconnect Wallet
          </GlossyButton>

          <GlossyButton onClick={onBack} className="w-full">
            Back to Menu
          </GlossyButton>
        </div>
      </div>
    </div>
  );
}
