import {
  getState,
  isHost,
  onPlayerJoin,
  useMultiplayerState,
  usePlayersList,
} from "playroomkit";
import { createContext, useContext } from "react";

export type GameState = {
}

const GameEngineContext = createContext<GameState | null>(null);

export const GameEngineProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const gameState = {

  }
  return (
    <GameEngineContext.Provider value={gameState}>
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
