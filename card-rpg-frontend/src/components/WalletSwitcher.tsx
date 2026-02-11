import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
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

  const [balance, setBalance] = useState<string | null>(null);
  const [isFunding, setIsFunding] = useState(false);
  const currentPlayer = getCurrentDevPlayer();
  const hasAttemptedConnection = useRef(false);

  // Auto-connect removed. The connection is handled via SplashScreen.

  const fetchBalance = async () => {
    if (!publicKey) return;
    try {
      // Fetch from Testnet Horizon
      const response = await fetch(
        `https://horizon-testnet.stellar.org/accounts/${publicKey}`,
      );
      if (response.ok) {
        const data = await response.json();
        const native = data.balances.find(
          (b: any) => b.asset_type === "native",
        );
        if (native) {
          setBalance(Math.floor(parseFloat(native.balance)).toString());
        }
      }
    } catch (e) {
      console.error("Failed to check balance:", e);
    }
  };

  useEffect(() => {
    if (isConnected && publicKey) {
      fetchBalance();
      // Poll balance every 10 seconds
      const interval = setInterval(fetchBalance, 10000);
      return () => clearInterval(interval);
    } else {
      setBalance(null);
    }
  }, [isConnected, publicKey]);

  const handleFund = async () => {
    if (!publicKey || isFunding) return;
    setIsFunding(true);
    const toastId = toast.loading("Requesting funds from Friendbot...");

    try {
      const response = await fetch(
        `https://friendbot.stellar.org/?addr=${publicKey}`,
      );
      if (response.ok) {
        await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait for ledger
        await fetchBalance();
        toast.success("Wallet funded! +10,000 XLM", { id: toastId });
      } else {
        const text = await response.text();
        console.warn("Friendbot response:", response.status, text);
        // 400 usually means account already exists, which is fine, just refresh balance
        if (response.status === 400) {
          await fetchBalance();
          toast.success("Account already funded", { id: toastId });
        } else {
          toast.error("Funding failed", { id: toastId });
        }
      }
    } catch (e) {
      console.error("Funding error:", e);
      toast.error("Funding error", { id: toastId });
    } finally {
      setIsFunding(false);
    }
  };

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
            {balance !== null && (
              <div
                className="wallet-address"
                style={{ fontSize: "0.75rem", color: "var(--color-ink-muted)" }}
              >
                {balance} XLM
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginLeft: "auto" }}>
            <button
              onClick={handleFund}
              className="switch-button"
              disabled={isFunding}
              style={{
                marginLeft: 0,
                padding: "0.45rem 0.75rem",
                width: "auto",
              }}
              title="Fund Wallet with Friendbot"
            >
              {isFunding ? "..." : "+Fund"}
            </button>
            {walletType === "dev" && (
              <button
                onClick={handleSwitch}
                className="switch-button"
                disabled={isConnecting}
                style={{ marginLeft: 0 }}
              >
                Switch
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
