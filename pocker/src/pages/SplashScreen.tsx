import GlossyButton from "../components/GlossyButton";

interface SplashScreenProps {
  onConnect: () => void;
  error: string | null;
  isConnecting: boolean;
}

export function SplashScreen({
  onConnect,
  error,
  isConnecting,
}: SplashScreenProps) {
  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center space-y-12 p-4">
      <header className="flex items-center justify-center w-full">
        <img src="/logo.png" className="h-16" alt="Logo" />
      </header>

      <div className="flex flex-col items-center justify-center space-y-12 flex-1">
        <p className="max-w-md text-white text-center text-xl">
          Connect your Stellar wallet to start playing multiplayer poker on the
          blockchain
        </p>

        {error && (
          <div className="bg-red-500/20 border-2 border-red-500/50 rounded-xl p-4 max-w-md">
            <p className="text-red-200 text-center text-sm">{error}</p>
            {error.includes("not installed") && (
              <a
                href="https://www.freighter.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-300 underline text-sm block text-center mt-2"
              >
                Install Freighter Wallet
              </a>
            )}
          </div>
        )}

        <GlossyButton
          onClick={onConnect}
          disabled={isConnecting}
          className="w-80"
        >
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </GlossyButton>
      </div>
    </div>
  );
}
