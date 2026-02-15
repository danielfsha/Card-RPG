export const INITIAL_LP = 8000;
export const INITIAL_HAND_SIZE = 5;
export const DRAW_PER_TURN = 1;
export const MAX_MONSTER_ZONES = 5;
export const NORMAL_SUMMONS_PER_TURN = 1;

export const PHASE = {
  DRAW: "DRAW",
  MAIN: "MAIN",

  // Main Phase Steps (Summoning)
  SELECT_HAND_CARD: "SELECT_HAND_CARD", // 1. Select card from hand (index 0-N)
  SELECT_POSITION: "SELECT_POSITION", // 2. Select ATK/DEF/SET
  SELECT_ZONE: "SELECT_ZONE", // 3. Select field zone (0-4)

  // Battle Phase Steps
  BATTLE: "BATTLE", // Enter Battle Phase
  SELECT_ATTACKER: "SELECT_ATTACKER", // 1. Choose own monster
  SELECT_TARGET: "SELECT_TARGET", // 2. Choose opponent monster or Direct

  END: "END",
} as const;

export type GamePhase = keyof typeof PHASE;

export const GAME_PHASES = [
  PHASE.DRAW,
  PHASE.MAIN,

  PHASE.SELECT_HAND_CARD,
  PHASE.SELECT_POSITION,
  PHASE.SELECT_ZONE,

  PHASE.BATTLE,
  PHASE.SELECT_ATTACKER,
  PHASE.SELECT_TARGET,

  PHASE.END,
] as const;

export const POSITION = {
  ATTACK: "ATTACK",
  DEFENSE: "DEFENSE",
  DEFENSE_DOWN: "DEFENSE_DOWN", // Face-down defense
} as const;

export type CardPosition = keyof typeof POSITION;

// Battle Result Constants
export const RESULT = {
  DESTROY_DEFENDER: "DESTROY_DEFENDER",
  DESTROY_ATTACKER: "DESTROY_ATTACKER",
  DESTROY_BOTH: "DESTROY_BOTH",
  NOTHING: "NOTHING",
} as const;

export type BattleResult = keyof typeof RESULT;

export const BATTLE_RESULTS = [
  RESULT.DESTROY_DEFENDER,
  RESULT.DESTROY_ATTACKER,
  RESULT.DESTROY_BOTH,
  RESULT.NOTHING,
];

export const WIN_REASON = {
  LP_ZERO: "LP_ZERO",
  DECK_OUT: "DECK_OUT",
  SURRENDER: "SURRENDER",
} as const;

// Legacy/Time constants (no longer applied as turn limits, but maybe used for defaults)
export const TIME_PHASE_CARDS = 0;
export const TIME_PHASE_PLAYER_CHOICE = 0;
export const TIME_PHASE_PLAYER_ACTION = 0;

export type WinReason = keyof typeof WIN_REASON;

export type DeckCard = {
  id: string;
  name: string;
  attack: number;
  defense: number;
};

export const DECK: DeckCard[] = [
  { id: "card1", name: "Warrior", attack: 2000, defense: 1500 },
  { id: "card2", name: "Mage", attack: 1500, defense: 1000 },
  { id: "card3", name: "Archer", attack: 1800, defense: 1200 },
  { id: "card4", name: "Giant", attack: 2500, defense: 2000 },
  { id: "card5", name: "Assassin", attack: 1700, defense: 800 },
  { id: "card6", name: "Paladin", attack: 1600, defense: 1800 },
  { id: "card7", name: "Necromancer", attack: 1900, defense: 1100 },
  { id: "card8", name: "Dragon", attack: 3000, defense: 2500 },
  { id: "card9", name: "Knight", attack: 2200, defense: 1600 },
  { id: "card10", name: "Rogue", attack: 1400, defense: 900 },
  { id: "card11", name: "Vampire", attack: 2100, defense: 1300 },
  { id: "card12", name: "Elemental", attack: 2300, defense: 1700 },
  { id: "card13", name: "Berserker", attack: 2400, defense: 1400 },
  { id: "card14", name: "Druid", attack: 1600, defense: 1900 },
  { id: "card15", name: "Shapeshifter", attack: 2000, defense: 2000 },
  { id: "card16", name: "Summoner", attack: 1800, defense: 1600 },
  { id: "card17", name: "Monk", attack: 1700, defense: 1500 },
  { id: "card18", name: "Samurai", attack: 2200, defense: 1800 },
  { id: "card19", name: "Ninja", attack: 1900, defense: 1200 },
  { id: "card20", name: "Priest", attack: 1500, defense: 2000 },
];
