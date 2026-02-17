import { createContext, useContext, type ReactNode } from "react";
import {
  useMultiplayerState,
  usePlayersList,
  isHost,
  onPlayerJoin,
  me,
} from "playroomkit";

interface GameEngineContextType {
  sessionId: number;
  players: any[];
  isHost: boolean;
  myPlayer: any;
  p1AuthEntryXDR: string;
  setP1AuthEntryXDR: (xdr: string) => void;
  setMyAddress: (address: string) => void;
  startGame: () => number;
  resetGame: () => void;
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

export const GameEngineProvider = ({ children }: { children: ReactNode }) => {
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
      console.log("[GameEngine] Generated new session ID:", newSessionId);
      setSessionId(newSessionId, true);
      setP1AuthEntryXDR("");
      return newSessionId;
    }
    return 0;
  };

  const resetGame = () => {
    setSessionId(0, true);
    setP1AuthEntryXDR("");
  };

  return (
    <GameEngineContext.Provider
      value={{
        sessionId,
        players,
        isHost: isHost(),
        myPlayer,
        p1AuthEntryXDR,
        setP1AuthEntryXDR,
        setMyAddress,
        startGame,
        resetGame,
      }}
    >
      {children}
    </GameEngineContext.Provider>
  );
};

export const useGameEngine = () => {
  const context = useContext(GameEngineContext);
  if (!context) {
    throw new Error("useGameEngine must be used within GameEngineProvider");
  }
  return context;
};
