import React from "react";

interface ModeSelectScreenProps {
  onSelectMode: (mode: "single" | "multi") => void;
  onOpenSettings: () => void;
  isLoading?: boolean;
}

export function ModeSelectScreen({
  onSelectMode,
  onOpenSettings,
  isLoading = false,
}: ModeSelectScreenProps) {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <h3 className="gradient-text" style={{ marginBottom: "2rem" }}>
        Choose Game Mode
      </h3>

      <div
        style={{
          display: "flex",
          gap: "1rem",
          justifyContent: "center",
          flexWrap: "wrap",
          flexDirection: "column",
          maxWidth: "300px",
          margin: "0 auto",
        }}
      >
        <button
          className="action-button"
          onClick={() => onSelectMode("single")}
          disabled={isLoading}
          style={{ padding: "1.5rem" }}
        >
          Single Player
          <div
            style={{
              fontSize: "0.8rem",
              opacity: 0.7,
              marginTop: "0.5rem",
              fontWeight: "normal",
            }}
          >
            Play locally or against bot
          </div>
        </button>

        <button
          className="action-button"
          onClick={() => onSelectMode("multi")}
          disabled={isLoading}
          style={{ padding: "1.5rem" }}
        >
          Multiplayer
          <div
            style={{
              fontSize: "0.8rem",
              opacity: 0.7,
              marginTop: "0.5rem",
              fontWeight: "normal",
            }}
          >
            Create or join a lobby
          </div>
        </button>

        <button
          className="secondary-button"
          onClick={onOpenSettings}
          disabled={isLoading}
          style={{ padding: "1rem" }}
        >
          Settings
        </button>
      </div>

      {isLoading && (
        <div className="notice info" style={{ marginTop: "2rem" }}>
          Initializing game environment...
        </div>
      )}
    </div>
  );
}
