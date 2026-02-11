import React from "react";
import { useWallet } from "../hooks/useWallet";

interface SplashScreenProps {
  onConnect: () => void;
}

export function SplashScreen({ onConnect }: SplashScreenProps) {
  const { isConnecting, error } = useWallet();

  return (
    <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
      <h1
        className="gradient-text"
        style={{ fontSize: "3rem", marginBottom: "1rem" }}
      >
        Card RPG
      </h1>
      <p
        style={{
          fontSize: "1.2rem",
          color: "var(--color-ink-muted)",
          marginBottom: "3rem",
        }}
      >
        An on-chain card game built on Stellar
      </p>

      <button
        className="action-button"
        onClick={onConnect}
        disabled={isConnecting}
        style={{ fontSize: "1.2rem", padding: "1rem 3rem" }}
      >
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </button>

      {error && (
        <div className="notice error" style={{ marginTop: "2rem" }}>
          {error}
        </div>
      )}
    </div>
  );
}
