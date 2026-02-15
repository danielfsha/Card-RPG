# Two-Player Card Game Rules

## Setup

- Each player starts with **8000 Life Points (LP)** and **5 cards in hand**.
- A random selection determines the starting player.

## Turn Structure

### 1. Draw Phase (Costed)

- Drawing a card **costs 500 LP**. When you draw, subtract 500 LP from your total.
- Drawing is manual (no auto-draw). You may only draw at the start of **your own turn** and only once per turn. You cannot draw on your opponent's turn.
- If you attempt to draw with no cards left in your deck, you lose the game immediately (deck out).

### 2. Action Phase (One Action Rule)

Choose **EXACTLY ONE** action per turn:

**OPTION A: Summon**

- Select a monster card from your hand.
- Select an empty zone on your field.
- Choose position: **Attack**, **Defense**, or **Face-Down Defense**.
- The turn **immediately ends** after the monster is summoned.

**OR**

**OPTION B: Attack**

- Select one of your monsters already on the field (must be in Attack Position).
- Select a target (opponent's monster or Direct Attack if eligible).
- Resolve the battle (damage calculation and destruction).
- The turn **immediately ends** after the battle resolves.

_Note: You cannot Summon and Attack in the same turn._

## Battle Rules

- **Attack Position** uses **ATK**.
- **Defense Position** (face-up or face-down) uses **DEF**.

### Battle Outcomes

1. **Attack vs Attack**
   - **Higher ATK wins**: Lower ATK monster destroyed. The loser’s player loses LP equal to the difference `(winner ATK - loser ATK)`.
   - **Equal ATK**: Both monsters destroyed. No LP damage.

2. **Attack vs Defense (face-up)**
   - **ATK > DEF**: Defender destroyed. No LP damage to either player.
   - **ATK < DEF**: Attacker destroyed. **No LP damage**.
   - **ATK = DEF**: No destruction. No LP damage.

3. **Attack vs Defense (face-down)**
   - **ATK > DEF**: Defender destroyed. No LP damage.
   - **ATK < DEF**: Attacker destroyed and the attacking player loses LP equal to the difference `(DEF - ATK)`.
   - **ATK = DEF**: No destruction. No LP damage.

4. **Direct Attack**
   - Only if the opponent has **no monsters** on the field.
   - Damage equals the attacker’s **ATK** and is applied to the defending player’s LP.

## Win Conditions

- Reduce the opponent’s LP to **0**.
- If a player has no cards left in their deck at the start of their turn (before drawing), they immediately lose (deck out), even if they still have LP.
- If a player attempts to draw and their deck is empty, they immediately lose (deck out).

## Potential Improvements & Pitfalls

- **Draw Cost Balance**: A static 500 LP draw cost can lead to rapid LP depletion. Consider scaling the cost, limiting draws per turn, or disallowing draws below a threshold LP.
- **Face-Down Information**: Face-down cards currently use their DEF without hidden information mechanics. If secrecy is desired, ensure the UI reveals stats only on flip/resolve and avoid leaking data through state.
- **Empty Zone Targeting**: Clicking an empty opponent zone currently falls back to auto-target or direct attack when possible. Consider requiring explicit direct attack selection to prevent misclick damage.
- **LP Floor & Win Check**: LP is clamped at 0 and win is checked immediately on LP or deck-out events.
- **Multi-Attack Prevention**: Attacks are limited per monster per turn; ensure UI disables re-selection and `attackedZoneIndices` isn’t bypassed by rapid inputs.
- **Summon/Attack End Turn**: The engine auto-ends turn after summon or attack. If more complex phases are added later, revisit the One Action Rule.

## Example Flow

Player A wins coin toss, goes first.

Player A summons "Dragon (ATK 2400/DEF 2000)" in Attack. Turn ends.

Player B draws (pays 500 LP), summons "Goblin (ATK 1800/DEF 1500)" in Defense. Turn ends.

Player A attacks: 2400 > 1500 → Goblin destroyed, no LP damage.

Player B sets "Turtle (ATK 800/DEF 2000)" face-down in Defense. Player A attacks with 1800 ATK: 1800 < 2000 → Attacker destroyed and Player A loses 200 LP.
