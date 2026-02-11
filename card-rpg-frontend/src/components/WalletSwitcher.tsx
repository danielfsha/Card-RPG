import { useEffect, useRef } from "react";
import { useWallet } from "../hooks/useWallet";
import "./WalletSwitcher.css";

export function WalletSwitcher() {
  const {
    publicKey,
    isConnected,
    isConnecting,
    walletType,
    error,
    connectDev,
    switchPlayer,
    getCurrentDevPlayer,
  } = useWallet();

  const currentPlayer = getCurrentDevPlayer();
  const hasAttemptedConnection = useRef(false);

  // Auto-connect removed. The connection is handled via SplashScreen.

  const handleSwitch = async () => {
    if (walletType !== "dev") return;

    const nextPlayer = currentPlayer === 1 ? 2 : 1;
    try {
      await switchPlayer(nextPlayer);
    } catch (err) {
      console.error("Failed to switch player:", err);
    }
  };

  if (!isConnected) {
    if (isConnecting) {
      return (
        <div className="wallet-switcher">
          <div className="wallet-status connecting">
            <span className="status-indicator"></span>
            <span className="status-text">Connecting...</span>
          </div>
        </div>
      );
    }
    // If not connected and not connecting, show simplified status or nothing.
    // The SplashScreen will prompt for connection.
    return (
      <div className="wallet-switcher">
        <div className="wallet-status disconnected">
          <span className="status-text">Not Connected</span>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-switcher">
      {error && <div className="wallet-error">{error}</div>}

      <div className="wallet-info">
        <div className="wallet-status connected">
          <span className="status-indicator"></span>
          <div className="wallet-details">
            <div className="wallet-label" title={publicKey || ""}>
              {walletType === "dev"
                ? `Dev Player ${currentPlayer}`
                : publicKey
                  ? `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`
                  : "Connected"}
            </div>
          </div>
          {walletType === "dev" && (
            <button
              onClick={handleSwitch}
              className="switch-button"
              disabled={isConnecting}
            >
              Switch
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
