import { createContext, useContext, type ReactNode, useState, useEffect } from "react";
import {
  useMultiplayerState,
  usePlayersList,
  isHost,
  me,
  Joystick,
} from "playroomkit";

interface Bullet {
  id: string;
  position: [number, number, number];
  angle: number;
  player: string;
}

interface Hit {
  id: string;
  position: [number, number, number];
}

interface GameEngineContextType {
  sessionId: number;
  players: Array<{ state: any; joystick: Joystick }>;
  isHost: boolean;
  myPlayer: any;
  p1AuthEntryXDR: string;
  setP1AuthEntryXDR: (xdr: string) => void;
  setMyAddress: (address: string) => void;
  startGame: () => number;
  resetGame: () => void;
  // Interstellar game state
  bullets: Bullet[];
  hits: Hit[];
  networkBullets: Bullet[];
  networkHits: Hit[];
  gameStarted: boolean;
  setGameStarted: (started: boolean) => void;
  onFire: (bullet: Bullet) => void;
  onHit: (bulletId: string, position: [number, number, number]) => void;
  onHitEnded: (hitId: string) => void;
  onKilled: (playerId: string) => void;
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
  const rawPlayers = usePlayersList(true);
  const myPlayer = me();

  // Create joysticks for each player
  const [players, setPlayers] = useState<Array<{ state: any; joystick: Joystick }>>([]);

  useEffect(() => {
    console.log("[GameEngine] Raw players count:", rawPlayers.length);
    console.log("[GameEngine] Raw players:", rawPlayers.map(p => ({ id: p.id, character: p.getState?.("character") })));
    
    const playersWithJoysticks = rawPlayers.map((state, index) => {
      // Check if we already have a joystick for this player
      const existing = players.find((p) => p.state.id === state.id);
      if (existing) {
        console.log("[GameEngine] Reusing existing joystick for player:", state.id);
        return existing;
      }
      
      // Assign character based on player order
      // Player 1 (index 0) = Frog, Player 2 (index 1) = Bee
      const character = index === 0 ? 'Astronaut_FinnTheFrog' : 'Astronaut_BarbaraTheBee';
      console.log(`[GameEngine] Assigning character ${character} to player ${state.id} (index ${index})`);
      state.setState("character", character, true);
      
      // Create new joystick for this player
      const joystick = new Joystick(state, {
        type: "angular",
        buttons: [{ id: "fire", label: "Fire" }],
      });
      
      return { state, joystick };
    });
    
    console.log("[GameEngine] Players with joysticks:", playersWithJoysticks.length);
    setPlayers(playersWithJoysticks);
  }, [rawPlayers.length]);

  // Interstellar game state (host-managed)
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [hits, setHits] = useState<Hit[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  
  // Network-synced state (for guests)
  const [networkBullets, setNetworkBullets] = useMultiplayerState<Bullet[]>("bullets", []);
  const [networkHits, setNetworkHits] = useMultiplayerState<Hit[]>("hits", []);

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
      setGameStarted(true);
      return newSessionId;
    }
    setGameStarted(true);
    return 0;
  };

  const resetGame = () => {
    setSessionId(0, true);
    setP1AuthEntryXDR("");
    setGameStarted(false);
    setBullets([]);
    setHits([]);
  };

  const onFire = (bullet: Bullet) => {
    if (isHost()) {
      setBullets((prev) => [...prev, bullet]);
    }
  };

  const onHit = (bulletId: string, position: [number, number, number]) => {
    if (isHost()) {
      // Remove bullet
      setBullets((prev) => prev.filter((b) => b.id !== bulletId));
      // Add hit effect
      const hitId = `hit-${Date.now()}-${Math.random()}`;
      setHits((prev) => [...prev, { id: hitId, position }]);
    }
  };

  const onHitEnded = (hitId: string) => {
    if (isHost()) {
      setHits((prev) => prev.filter((h) => h.id !== hitId));
    }
  };

  const onKilled = (playerId: string) => {
    console.log("[GameEngine] Player killed:", playerId);
    // TODO: Handle player death, respawn, etc.
  };

  // Sync bullets to network (host only)
  useEffect(() => {
    if (isHost()) {
      setNetworkBullets(bullets);
    }
  }, [bullets, setNetworkBullets]);

  // Sync hits to network (host only)
  useEffect(() => {
    if (isHost()) {
      setNetworkHits(hits);
    }
  }, [hits, setNetworkHits]);

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
        // Interstellar game state
        bullets,
        hits,
        networkBullets,
        networkHits,
        gameStarted,
        setGameStarted,
        onFire,
        onHit,
        onHitEnded,
        onKilled,
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
