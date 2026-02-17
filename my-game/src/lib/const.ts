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
  id?: string;
  name: string;
  attack: number;
  defense: number;
  // Additional fields from cards.json
  Name?: string;
  Level?: number;
  ATK?: number;
  DEF?: number;
  Species?: string;
  Description?: string;
  image?: string;
};

// Import cards from cards.json
import cardsData from '../../public/cards.json';

// Transform cards.json to DeckCard format
export const DECK: DeckCard[] = cardsData.map((card: any, index: number) => ({
  id: `card${index + 1}`,
  name: card.Name,
  attack: card.ATK,
  defense: card.DEF,
  // Keep original fields for compatibility
  Name: card.Name,
  Level: card.Level,
  ATK: card.ATK,
  DEF: card.DEF,
  Species: card.Species,
  Description: card.Description,
  image: card.image,
}));
