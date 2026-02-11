import React from "react";
import { useWallet } from "../hooks/useWallet";

interface SettingsScreenProps {
  onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { disconnect, publicKey } = useWallet();
  const userAddress = publicKey;

  return (
    <div className="card" style={{ textAlign: "center" }}>
      <h3 className="gradient-text" style={{ marginBottom: "2rem" }}>
        Settings
      </h3>

      <div style={{ textAlign: "left", marginBottom: "2rem" }}>
        <div style={{ marginBottom: "1rem" }}>
          <strong>Connected Address:</strong>
          <div
            style={{
              wordBreak: "break-all",
              color: "var(--color-ink-muted)",
              fontSize: "0.9rem",
            }}
          >
            {userAddress}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          maxWidth: "300px",
          margin: "0 auto",
        }}
      >
        <button
          className="secondary-button"
          onClick={() => {
            disconnect();
            onBack(); // Usually disconnecting might take us to Splash, but App.tsx will handle the state change if isConnected changes
          }}
          style={{ padding: "1rem" }}
        >
          Disconnect Wallet
        </button>

        <button
          className="action-button"
          onClick={onBack}
          style={{ padding: "1rem" }}
        >
          Back to Menu
        </button>
      </div>
    </div>
  );
}
