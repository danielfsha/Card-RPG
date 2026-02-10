import React, { createContext, useContext, useEffect, useState } from "react";
import {
  useMultiplayerState,
  usePlayersList,
  isHost,
  onPlayerJoin,
  me,
} from "playroomkit";

interface GameEngineContextType {
  sessionId: number;
  players: any[]; // Playroom players
  isHost: boolean;
  myPlayer: any;
  setMyAddress: (address: string) => void;
  startGame: () => void;
  resetGame: () => void;
  p1AuthEntryXDR: string;
  setP1AuthEntryXDR: (xdr: string) => void;
}

const GameEngineContext = createContext<GameEngineContextType | null>(null);

const createRandomSessionId = (): number => {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    let value = 0;
    const buffer = new Uint32Array(1);
    while (value === 0) {
      crypto.getRandomValues(buffer);
      value = buffer[0];
    }
    return value;
  }
  return Math.floor(Math.random() * 0xffffffff) >>> 0 || 1;
};

export const GameEngineProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [sessionId, setSessionId] = useMultiplayerState("sessionId", 0);
  const [p1AuthEntryXDR, setP1AuthEntryXDRState] = useMultiplayerState(
    "p1AuthEntryXDR",
    "",
  );
  const players = usePlayersList(true);
  const myPlayer = me();

  const setP1AuthEntryXDR = (xdr: string) => {
    setP1AuthEntryXDRState(xdr, true);
  };

  const setMyAddress = (address: string) => {
    if (myPlayer) {
      myPlayer.setState("address", address, true);
    }
  };

  const startGame = () => {
    if (isHost()) {
      const newSessionId = createRandomSessionId();
      setSessionId(newSessionId, true);
      setP1AuthEntryXDR("");
    }
  };

  const resetGame = () => {
    setSessionId(0, true);
    setP1AuthEntryXDR("");
  };

  useEffect(() => {
    if (isHost() && sessionId === 0) {
      startGame();
    }
    onPlayerJoin(() => {
      // Handle new player join if necessary
    });
  }, []);

  return (
    <GameEngineContext.Provider
      value={{
        sessionId,
        players,
        isHost: isHost(),
        myPlayer,
        setMyAddress,
        startGame,
        resetGame,
        p1AuthEntryXDR,
        setP1AuthEntryXDR,
      }}
    >
      {children}
    </GameEngineContext.Provider>
  );
};

export const useGameEngine = () => {
  const context = useContext(GameEngineContext);
  if (!context) {
    throw new Error("useGameEngine must be used within a GameEngineProvider");
  }
  return context;
};
