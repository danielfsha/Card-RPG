import React, { useState } from "react";

interface ModeSelectScreenProps {
  onSelectMode: (mode: "single" | "multi", roomCode?: string) => void;
  onOpenSettings: () => void;
  isLoading?: boolean;
}

export function ModeSelectScreen({
  onSelectMode,
  onOpenSettings,
  isLoading = false,
}: ModeSelectScreenProps) {
  const [inMultiplayerMenu, setInMultiplayerMenu] = useState(false);
  const [inJoinMode, setInJoinMode] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim()) {
      onSelectMode("multi", joinCode.trim());
    }
  };

  if (inJoinMode) {
    return (
      <div
        className="card"
        style={{ textAlign: "center", maxWidth: "400px", margin: "0 auto" }}
      >
        <h3 className="gradient-text" style={{ marginBottom: "1.5rem" }}>
          Join Game
        </h3>
        <form
          onSubmit={handleJoinSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Enter Room Code"
            className="input-field" // Assuming global class exists or will verify
            style={{
              padding: "1rem",
              fontSize: "1rem",
              border: "1px solid var(--color-border)",
              borderRadius: "4px",
              background: "rgba(255,255,255,0.5)",
              textAlign: "center",
              color: "var(--color-ink)",
            }}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="action-button"
            disabled={!joinCode.trim() || isLoading}
            style={{ padding: "1rem" }}
          >
            {isLoading ? "Joining..." : "Join Now"}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setInJoinMode(false);
              setJoinCode("");
            }}
            disabled={isLoading}
            style={{ padding: "1rem" }}
          >
            Back
          </button>
        </form>
      </div>
    );
  }

  if (inMultiplayerMenu) {
    return (
      <div className="card" style={{ textAlign: "center" }}>
        <h3 className="gradient-text" style={{ marginBottom: "2rem" }}>
          Multiplayer Lobby
        </h3>
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
            className="action-button"
            onClick={() => onSelectMode("multi")} // Empty code = Create
            disabled={isLoading}
            style={{ padding: "1.5rem" }}
          >
            Create New Game
            <div
              style={{
                fontSize: "0.8rem",
                opacity: 0.7,
                marginTop: "0.5rem",
                fontWeight: "normal",
              }}
            >
              Start a new lobby and invite friends
            </div>
          </button>

          <button
            className="action-button"
            onClick={() => setInJoinMode(true)}
            disabled={isLoading}
            style={{ padding: "1.5rem" }}
          >
            Join Game
            <div
              style={{
                fontSize: "0.8rem",
                opacity: 0.7,
                marginTop: "0.5rem",
                fontWeight: "normal",
              }}
            >
              Enter a code to join an existing lobby
            </div>
          </button>

          <button
            className="secondary-button"
            onClick={() => setInMultiplayerMenu(false)}
            disabled={isLoading}
            style={{ padding: "1rem" }}
          >
            Back
          </button>
        </div>
        {isLoading && (
          <div className="notice info" style={{ marginTop: "2rem" }}>
            Connecting to lobby...
          </div>
        )}
      </div>
    );
  }

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
          onClick={() => setInMultiplayerMenu(true)}
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
