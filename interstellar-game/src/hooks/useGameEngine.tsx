import {
  insertCoin,
  isHost,
  myPlayer,
  onPlayerJoin,
  useMultiplayerState,
  Joystick,
} from "playroomkit";
import { useEffect, useState } from "react";

export interface Player {
  state: any;
  joystick: Joystick;
}

export interface Bullet {
  id: string;
  position: [number, number, number];
  angle: number;
  player: string;
}

export interface Hit {
  id: string;
  position: [number, number, number];
}

export const useGameEngine = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [hits, setHits] = useState<Hit[]>([]);
  const [networkBullets, setNetworkBullets] = useMultiplayerState<Bullet[]>("bullets", []);
  const [networkHits, setNetworkHits] = useMultiplayerState<Hit[]>("hits", []);
  const [gameStarted, setGameStarted] = useState(false);

  const startGame = async () => {
    try {
      // Start the game
      await insertCoin();
      setGameStarted(true);

      // Available characters to assign
      const availableCharacters = [
        'Astronaut_FinnTheFrog',
        'Astronaut_BarbaraTheBee',
        'Astronaut_FernandoTheFlamingo',
        'Astronaut_RaeTheRedPanda',
      ];

      let characterIndex = 0;

      // Create a joystick controller for each joining player
      onPlayerJoin((state) => {
        // Joystick will only create UI for current player (myPlayer)
        // For others, it will only sync their state
        const joystick = new Joystick(state, {
          type: "angular",
          buttons: [{ id: "fire", label: "Fire" }],
        });

        const newPlayer: Player = { state, joystick };
        
        // Assign character to player (cycle through available characters)
        const assignedCharacter = availableCharacters[characterIndex % availableCharacters.length];
        characterIndex++;
        
        // Initialize player state
        state.setState("health", 100);
        state.setState("deaths", 0);
        state.setState("kills", 0);
        state.setState("position", [0, 2, 0]);
        state.setState("rotation", 0);
        state.setState("character", assignedCharacter);

        setPlayers((players) => [...players, newPlayer]);

        state.onQuit(() => {
          setPlayers((players) => players.filter((p) => p.state.id !== state.id));
        });
      });
    } catch (error) {
      console.error("Failed to start game:", error);
    }
  };

  useEffect(() => {
    startGame();
  }, []);

  const onFire = (bullet: Bullet) => {
    setBullets((bullets) => [...bullets, bullet]);
  };

  const onHit = (bulletId: string, position: [number, number, number]) => {
    setBullets((bullets) => bullets.filter((bullet) => bullet.id !== bulletId));
    setHits((hits) => [...hits, { id: bulletId, position }]);
  };

  const onHitEnded = (hitId: string) => {
    setHits((hits) => hits.filter((h) => h.id !== hitId));
  };

  const onKilled = (_victim: string, killer: string) => {
    const killerPlayer = players.find((p) => p.state.id === killer);
    if (killerPlayer) {
      const currentKills = killerPlayer.state.getState("kills") || 0;
      killerPlayer.state.setState("kills", currentKills + 1);
    }
  };

  // Sync bullets to network
  useEffect(() => {
    if (isHost()) {
      setNetworkBullets(bullets);
    }
  }, [bullets, setNetworkBullets]);

  // Sync hits to network
  useEffect(() => {
    if (isHost()) {
      setNetworkHits(hits);
    }
  }, [hits, setNetworkHits]);

  return {
    players,
    bullets: isHost() ? bullets : networkBullets,
    hits: isHost() ? hits : networkHits,
    gameStarted,
    myPlayer: myPlayer(),
    isHost: isHost(),
    onFire,
    onHit,
    onHitEnded,
    onKilled,
  };
};
