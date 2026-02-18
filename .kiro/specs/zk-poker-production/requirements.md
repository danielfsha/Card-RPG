# ZK Poker Production Requirements

## 1. Overview

### 1.1 Project Description
A production-grade, fully-featured Texas Hold'em poker game built on Stellar blockchain with zero-knowledge proofs for privacy, fairness, and verifiable randomness. The game implements complete poker mechanics including multi-round betting, community cards, and provable hand rankings.

### 1.2 Core Objectives
- Implement complete Texas Hold'em poker rules with ZK privacy
- Ensure provable fairness at every stage (shuffle, deal, betting, showdown)
- Support multi-round gameplay (preflop, flop, turn, river, showdown)
- Maintain verifiable game statistics on-chain
- Provide seamless UX with real-time game state updates

### 1.3 Technology Stack
- **Blockchain**: Stellar (Soroban smart contracts)
- **ZK Proofs**: Circom circuits + Groth16 (snarkjs)
- **Frontend**: React + TypeScript + Playroom Kit
- **Wallet**: Freighter integration

---

## 2. User Stories

### 2.1 Game Setup & Initialization

**US-001: As a player, I want to create a poker room so that I can invite others to play**
- Acceptance Criteria:
  - Player can create a room with configurable buy-in amount
  - Room generates unique code for sharing
  - Room supports exactly 2 players (heads-up poker)
  - Creator becomes initial dealer button holder

**US-002: As a player, I want to join an existing room using a room code**
- Acceptance Criteria:
  - Player can enter 4-character room code
  - System validates room exists and has space
  - Player automatically joins as second player
  - Game initializes when both players are ready

**US-003: As a player, I want the dealer button position determined fairly**
- Acceptance Criteria:
  - Both players commit encrypted random seeds
  - ZK VRF circuit generates provable random number
  - Dealer button assigned based on VRF output
  - Proof verifies fairness without revealing seeds
  - Button rotates left after each hand

### 2.2 Blinds & Ante

**US-004: As a player, I want blinds automatically posted based on dealer position**
- Acceptance Criteria:
  - Small blind (left of button) auto-commits 0.1 XLM
  - Big blind (next position) auto-commits 0.2 XLM
  - Blinds deducted from player stacks automatically
  - Pot displays total blind amount
  - Contract enforces blind posting via require_auth

**US-005: As a player, I want to see my current stack and the pot size**
- Acceptance Criteria:
  - Stack size displayed in XLM
  - Pot size updated in real-time
  - Committed amounts shown during betting
  - Stack decreases when betting/calling
  - Stack increases when winning pot

### 2.3 Deck Shuffling & Card Dealing

**US-006: As a player, I want the deck shuffled fairly using multi-party computation**
- Acceptance Criteria:
  - Each player shuffles encrypted 52-card deck
  - Player commits permutation + SNARK proof
  - Proof validates no duplicates or card changes
  - Contract verifies proofs sequentially
  - Final shuffled deck is cryptographically secure

**US-007: As a player, I want to receive 2 hole cards privately**
- Acceptance Criteria:
  - System deals 2 encrypted hole cards per player
  - ZK proof validates correct deal from shuffled deck
  - Players decrypt own cards privately (not visible to opponent)
  - Cards displayed face-up to owner only
  - Opponent sees card backs

**US-008: As a player, I want 5 community cards committed upfront**
- Acceptance Criteria:
  - All 5 community cards encrypted and committed at deal time
  - Burn cards included in commitment
  - ZK proof validates cards from shuffled deck
  - Cards revealed progressively (flop/turn/river)
  - Proof ensures no card substitution between rounds

### 2.4 Betting Rounds

**US-009: As a player, I want to bet during the preflop round**
- Acceptance Criteria:
  - Small blind acts first preflop
  - Available actions: Fold, Call (0.2 XLM), Raise (≥0.4 XLM)
  - Bet amounts encrypted and committed
  - ZK proof validates bet meets minimum requirements
  - Contract updates pot atomically
  - Betting continues until both players call or one folds

**US-010: As a player, I want to bet after the flop (3 community cards)**
- Acceptance Criteria:
  - Small blind acts first post-flop
  - Available actions: Check, Bet, Call, Raise, Fold
  - Check allowed if no prior bet in round
  - Minimum bet is 0.2 XLM (big blind amount)
  - Raise must be at least 2x previous bet
  - Round ends when both players check or call

**US-011: As a player, I want to bet after the turn (4th community card)**
- Acceptance Criteria:
  - Same betting rules as flop
  - Pot size includes all previous bets
  - Players can go all-in
  - Round ends when both players check or call

**US-012: As a player, I want to bet after the river (5th community card)**
- Acceptance Criteria:
  - Final betting round
  - Same betting rules as turn
  - Round ends when both players check or call
  - Proceeds to showdown if both players remain

**US-013: As a player, I want betting validated with ZK proofs**
- Acceptance Criteria:
  - Each bet includes ZK proof of validity
  - Proof validates: amount ≥ minimum, player has funds, action is legal
  - Anti-collusion patterns detected via proof analysis
  - Invalid bets rejected by contract
  - Proof generation happens client-side

### 2.5 Community Card Reveals

**US-014: As a player, I want the flop (3 cards) revealed after preflop betting**
- Acceptance Criteria:
  - Burn 1 card (ZK-proven burn)
  - Reveal 3 community cards via ZK partial decryption
  - Proof matches pre-deal commitment
  - Cards displayed on table
  - No card substitution possible

**US-015: As a player, I want the turn (4th card) revealed after flop betting**
- Acceptance Criteria:
  - Burn 1 card (ZK-proven burn)
  - Reveal 4th community card
  - Proof validates against commitment
  - Card added to community display

**US-016: As a player, I want the river (5th card) revealed after turn betting**
- Acceptance Criteria:
  - Burn 1 card (ZK-proven burn)
  - Reveal 5th community card
  - Proof validates against commitment
  - All 5 community cards now visible

### 2.6 Hand Evaluation & Showdown

**US-017: As a player, I want my hand evaluated privately during gameplay**
- Acceptance Criteria:
  - Client-side hand ranking calculation
  - Best 5-card hand from 7 cards (2 hole + 5 community)
  - Hand strength displayed to player only
  - Rankings: High Card, Pair, Two Pair, Three of a Kind, Straight, Flush, Full House, Four of a Kind, Straight Flush, Royal Flush
  - Kicker cards considered for tie-breaking

**US-018: As a player, I want the winner determined fairly at showdown**
- Acceptance Criteria:
  - Both players reveal decryption keys via Playroom
  - Off-chain: Both clients generate ZK proof of hand rankings
  - Proof includes: player1 hand, player2 hand, rankings, winner
  - On-chain: Contract verifies Groth16 proof
  - Winner extracted from public signals
  - Pot transferred to winner automatically

**US-019: As a player, I want to win the pot if opponent folds**
- Acceptance Criteria:
  - If opponent folds, I win immediately
  - No hand reveal required
  - Pot transferred automatically
  - Game ends without showdown
  - Fold recorded in game history

### 2.7 Pot Distribution

**US-020: As a player, I want to receive my winnings automatically**
- Acceptance Criteria:
  - Winner receives entire pot
  - Transfer happens atomically on-chain
  - Balance updated immediately
  - Transaction confirmed before next hand
  - Pot reset to 0 after distribution

**US-021: As a player, I want to accept/claim my winnings explicitly**
- Acceptance Criteria:
  - "Claim Pot" button appears for winner
  - Button shows pot amount
  - Clicking triggers on-chain claim transaction
  - Wallet prompts for signature
  - Success toast shows amount claimed

### 2.8 Game Statistics

**US-022: As a player, I want to see my verifiable game statistics**
- Acceptance Criteria:
  - Total games played (on-chain counter)
  - Games won (verified via end_game events)
  - Win rate percentage
  - Total XLM won/lost
  - Biggest pot won
  - Current streak (wins/losses)
  - All stats verifiable via blockchain events

**US-023: As a player, I want my statistics stored on-chain**
- Acceptance Criteria:
  - Stats stored in contract storage per player address
  - Updated atomically after each game
  - Queryable via contract method
  - Immutable history (append-only)
  - Stats survive contract upgrades

**US-024: As a player, I want to view opponent's statistics**
- Acceptance Criteria:
  - Opponent stats displayed in lobby
  - Shows: games played, win rate, total winnings
  - Stats fetched from contract
  - Updated in real-time
  - Helps assess opponent skill level

### 2.9 Game Flow & State Management

**US-025: As a player, I want clear visual indication of current game phase**
- Acceptance Criteria:
  - Phase indicator shows: Preflop, Flop, Turn, River, Showdown
  - Active player highlighted
  - Timer shows time remaining for action
  - Phase transitions animated
  - Sound effects for phase changes

**US-026: As a player, I want to see whose turn it is**
- Acceptance Criteria:
  - Active player border highlighted
  - "Your Turn" indicator when it's my turn
  - "Waiting for opponent" when it's their turn
  - Action buttons enabled/disabled based on turn
  - Timeout warning if taking too long

**US-027: As a player, I want the game to handle disconnections gracefully**
- Acceptance Criteria:
  - Disconnected player has 60 seconds to reconnect
  - Game state preserved during disconnect
  - Reconnected player sees current game state
  - If timeout expires, disconnected player auto-folds
  - Opponent wins pot automatically

### 2.10 UI/UX Enhancements

**US-028: As a player, I want to see betting history for the current hand**
- Acceptance Criteria:
  - Betting log shows all actions in order
  - Format: "Player1 raises to 0.4 XLM"
  - Scrollable if many actions
  - Cleared at start of new hand
  - Color-coded by action type

**US-029: As a player, I want visual feedback for all actions**
- Acceptance Criteria:
  - Chips animate from player to pot when betting
  - Cards flip animation when revealed
  - Winner celebration animation
  - Fold animation (cards slide away)
  - Sound effects for each action

**US-030: As a player, I want to see pot odds and hand equity**
- Acceptance Criteria:
  - Pot odds displayed during betting decisions
  - Estimated hand equity vs random hand
  - Equity updates after each community card
  - Helps make informed decisions
  - Toggle to show/hide advanced stats

---

## 3. Technical Requirements

### 3.1 ZK Circuits (Circom)

**TR-001: VRF Circuit for Dealer Button**
- Circuit: `prove_random_roll.circom`
- Inputs: player1_seed, player2_seed
- Outputs: random_number (0-1), proof
- Constraints: ~1000
- Purpose: Provably fair dealer button assignment

**TR-002: Deck Shuffle Circuit**
- Circuit: `prove_shuffle.circom`
- Inputs: original_deck[52], permutation[52], player_id
- Outputs: shuffled_deck[52], proof
- Constraints: ~50,000
- Purpose: Verify valid shuffle (no duplicates, all cards present)

**TR-003: Card Deal Circuit**
- Circuit: `prove_deal.circom`
- Inputs: shuffled_deck[52], deal_positions[9]
- Outputs: dealt_cards[9], proof
- Constraints: ~10,000
- Purpose: Prove cards dealt from top of shuffled deck

**TR-004: Betting Validation Circuit**
- Circuit: `prove_bet.circom`
- Inputs: bet_amount, player_stack, min_bet, action_type
- Outputs: valid (0/1), proof
- Constraints: ~500
- Purpose: Validate bet meets requirements

**TR-005: Community Card Reveal Circuit**
- Circuit: `prove_reveal.circom`
- Inputs: commitment, decryption_key, card_index
- Outputs: revealed_card, proof
- Constraints: ~2,000
- Purpose: Prove revealed card matches commitment

**TR-006: Hand Ranking Circuit (Enhanced)**
- Circuit: `poker_game.circom` (existing, needs enhancement)
- Inputs: player1_cards[2], player2_cards[2], community[5], salts
- Outputs: player1_ranking, player2_ranking, winner, proof
- Constraints: ~100,000
- Purpose: Evaluate hands and determine winner

### 3.2 Smart Contract (Soroban)

**TR-007: Multi-Round Game State**
```rust
pub struct GameState {
    session_id: u32,
    player1: Address,
    player2: Address,
    dealer_button: u8, // 0 or 1
    phase: GamePhase, // Preflop, Flop, Turn, River, Showdown
    pot: i128,
    player1_stack: i128,
    player2_stack: i128,
    player1_bet: i128,
    player2_bet: i128,
    community_cards: Vec<u8>, // Revealed cards
    deck_commitment: BytesN<32>,
    current_actor: u8,
    last_action: Action,
}
```

**TR-008: Betting Actions**
```rust
pub enum Action {
    Fold,
    Check,
    Call,
    Bet(i128),
    Raise(i128),
    AllIn,
}
```

**TR-009: Game Phase Transitions**
```rust
pub enum GamePhase {
    Preflop,
    Flop,
    Turn,
    River,
    Showdown,
    Complete,
}
```

**TR-010: Player Statistics**
```rust
pub struct PlayerStats {
    games_played: u32,
    games_won: u32,
    total_winnings: i128,
    biggest_pot: i128,
    current_streak: i32, // Positive for wins, negative for losses
}
```

**TR-011: Contract Methods**
- `start_game(session_id, player1, player2, dealer_button, vrf_proof)`
- `post_blinds(session_id, player)`
- `commit_shuffle(session_id, player, shuffle_proof)`
- `deal_cards(session_id, deal_proof)`
- `player_action(session_id, player, action, bet_proof)`
- `reveal_community(session_id, phase, reveal_proof)`
- `reveal_winner(session_id, hand_proof, public_signals)`
- `claim_pot(session_id, player)`
- `get_stats(player) -> PlayerStats`
- `end_game(session_id, winner)`

### 3.3 Frontend Architecture

**TR-012: Game State Management**
- Use React Context for global game state
- Real-time sync via Playroom Kit
- Optimistic UI updates with rollback
- State persistence in localStorage
- State validation against contract

**TR-013: ZK Proof Generation**
- Client-side proof generation using snarkjs
- Web Worker for non-blocking computation
- Progress indicator during proof generation
- Proof caching where applicable
- Error handling and retry logic

**TR-014: Wallet Integration**
- Freighter wallet for transaction signing
- Multi-sig support for game actions
- Transaction batching where possible
- Gas estimation and fee display
- Transaction history tracking

**TR-015: Real-Time Communication**
- Playroom Kit for P2P state sync
- Action broadcasting to opponent
- Heartbeat for connection monitoring
- Reconnection handling
- Conflict resolution

### 3.4 Security Requirements

**TR-016: Cryptographic Security**
- All random seeds generated using crypto.getRandomValues()
- Commitments use SHA-256 or Poseidon hash
- Encryption uses AES-256-GCM
- Keys never transmitted in plaintext
- Secure key derivation (PBKDF2)

**TR-017: Anti-Cheating Measures**
- All game actions require ZK proofs
- Contract validates all proofs on-chain
- Timeout mechanism prevents stalling
- Collusion detection via betting patterns
- Audit trail of all actions

**TR-018: Privacy Guarantees**
- Hole cards never revealed until showdown
- Betting amounts encrypted until committed
- Shuffle permutations remain private
- Only winner revealed, not full hands (unless showdown)
- No information leakage via timing

### 3.5 Performance Requirements

**TR-019: Proof Generation Performance**
- VRF proof: < 1 second
- Shuffle proof: < 5 seconds
- Deal proof: < 2 seconds
- Bet proof: < 500ms
- Hand ranking proof: < 10 seconds

**TR-020: Transaction Performance**
- Contract calls: < 5 seconds confirmation
- State updates: < 2 seconds propagation
- UI responsiveness: < 100ms for user actions
- Proof verification on-chain: < 1 second
- Total game duration: < 10 minutes

**TR-021: Scalability**
- Support 100+ concurrent games
- Contract storage optimized (< 10KB per game)
- Efficient proof verification (< 1M gas)
- Minimal blockchain reads/writes
- State cleanup after game completion

---

## 4. Testing Requirements

### 4.1 Circuit Testing

**TEST-001: VRF Circuit Tests**
- Test random output distribution
- Test determinism (same inputs = same output)
- Test proof verification
- Test invalid seed rejection

**TEST-002: Shuffle Circuit Tests**
- Test valid shuffle acceptance
- Test duplicate card rejection
- Test missing card rejection
- Test permutation validity
- Test multi-party shuffle sequence

**TEST-003: Deal Circuit Tests**
- Test correct card dealing
- Test deal from shuffled deck
- Test invalid deal rejection
- Test burn card handling

**TEST-004: Betting Circuit Tests**
- Test valid bet acceptance
- Test insufficient funds rejection
- Test minimum bet enforcement
- Test raise validation

**TEST-005: Hand Ranking Circuit Tests**
- Test all hand rankings (10 types)
- Test tie-breaking with kickers
- Test winner determination
- Test edge cases (wheel straight, etc.)

### 4.2 Contract Testing

**TEST-006: Game Initialization Tests**
- Test game creation
- Test blind posting
- Test dealer button assignment
- Test invalid player rejection

**TEST-007: Betting Round Tests**
- Test preflop betting
- Test post-flop betting
- Test turn betting
- Test river betting
- Test fold handling
- Test all-in handling

**TEST-008: Phase Transition Tests**
- Test preflop → flop
- Test flop → turn
- Test turn → river
- Test river → showdown
- Test early termination (fold)

**TEST-009: Pot Distribution Tests**
- Test winner receives pot
- Test pot reset after distribution
- Test split pot (if tie)
- Test rake deduction (if applicable)

**TEST-010: Statistics Tests**
- Test stats initialization
- Test stats update after win
- Test stats update after loss
- Test stats persistence
- Test stats query

### 4.3 Integration Testing

**TEST-011: End-to-End Game Flow**
- Test complete game from start to showdown
- Test game with fold
- Test game with all-in
- Test multiple hands in sequence
- Test disconnection and reconnection

**TEST-012: Multi-Player Testing**
- Test 2-player game flow
- Test simultaneous actions
- Test action ordering
- Test state synchronization
- Test conflict resolution

**TEST-013: Performance Testing**
- Test proof generation times
- Test transaction confirmation times
- Test UI responsiveness under load
- Test memory usage
- Test network bandwidth

### 4.4 Security Testing

**TEST-014: Cheating Prevention Tests**
- Test invalid proof rejection
- Test card substitution prevention
- Test betting manipulation prevention
- Test timeout enforcement
- Test replay attack prevention

**TEST-015: Privacy Tests**
- Test hole card privacy
- Test betting amount privacy
- Test shuffle privacy
- Test no information leakage
- Test secure key handling

---

## 5. User Interface Requirements

### 5.1 Game Screen Layout

**UI-001: Poker Table**
- Elliptical green felt surface
- Wood border with shadow
- Center pot display with XLM amount
- Phase indicator (Preflop/Flop/Turn/River/Showdown)
- Session ID display

**UI-002: Player Areas**
- Top: Opponent area with card backs
- Bottom: Player area with face-up cards
- Each area shows: name, stack size, current bet
- Dealer button indicator
- Active player highlight

**UI-003: Community Cards**
- Center of table
- 5 card slots
- Cards revealed progressively
- Flip animation on reveal
- Burn card indicator

**UI-004: Action Controls**
- Bottom fixed panel
- Buttons: Fold, Check/Call, Bet/Raise
- Bet slider for raise amount
- All-in button
- Disabled when not player's turn

**UI-005: Game Information**
- Pot size (large, center)
- Player stacks (corner displays)
- Current bet to call
- Pot odds calculator
- Hand strength indicator

### 5.2 Lobby Screen

**UI-006: Room Creation**
- Buy-in amount selector
- Create Room button
- Room code display (large, copyable)
- Waiting for opponent indicator

**UI-007: Room Joining**
- Room code input (4 characters)
- Join button
- Invalid code error handling
- Room full error handling

**UI-008: Player List**
- Shows both players when joined
- Ready status indicators
- Player addresses (truncated)
- Host indicator
- Start Game button (host only)

### 5.3 Statistics Screen

**UI-009: Player Stats Dashboard**
- Games played counter
- Win/loss record
- Win rate percentage
- Total winnings (XLM)
- Biggest pot won
- Current streak
- Historical graph (optional)

**UI-010: Leaderboard (Optional)**
- Top players by win rate
- Top players by total winnings
- Top players by games played
- Filterable by time period

### 5.4 Settings & Wallet

**UI-011: Wallet Modal**
- Connected address display
- Balance display (XLM)
- Copy address button
- Disconnect button
- Transaction history link

**UI-012: Game Settings**
- Sound effects toggle
- Animation speed
- Auto-muck option (hide losing hand)
- Show pot odds toggle
- Theme selection (optional)

---

## 6. Non-Functional Requirements

### 6.1 Usability
- NFR-001: Game must be playable by poker beginners
- NFR-002: All actions must have clear visual feedback
- NFR-003: Error messages must be user-friendly
- NFR-004: Game must work on desktop and tablet (mobile optional)
- NFR-005: Loading states must be clear and informative

### 6.2 Reliability
- NFR-006: Game state must never be lost due to disconnection
- NFR-007: Contract must handle all edge cases gracefully
- NFR-008: Proof generation must succeed 99.9% of the time
- NFR-009: Transaction failures must be retryable
- NFR-010: Game must recover from network issues

### 6.3 Maintainability
- NFR-011: Code must be well-documented
- NFR-012: Circuits must have clear comments
- NFR-013: Contract must be upgradeable
- NFR-014: Frontend must be modular and testable
- NFR-015: All components must have unit tests

### 6.4 Compliance
- NFR-016: Game must comply with Stellar network rules
- NFR-017: No gambling regulations violated (play money only)
- NFR-018: Privacy regulations respected (GDPR if applicable)
- NFR-019: Open source license (MIT or Apache 2.0)
- NFR-020: Audit trail for all transactions

---

## 7. Constraints & Assumptions

### 7.1 Constraints
- CONST-001: Stellar blockchain transaction fees apply
- CONST-002: Proof generation requires modern browser (WebAssembly)
- CONST-003: Game limited to 2 players (heads-up only)
- CONST-004: Minimum buy-in: 1 XLM
- CONST-005: Maximum game duration: 30 minutes (timeout)

### 7.2 Assumptions
- ASSUME-001: Players have Freighter wallet installed
- ASSUME-002: Players have sufficient XLM for buy-in + fees
- ASSUME-003: Players have stable internet connection
- ASSUME-004: Players understand basic poker rules
- ASSUME-005: Players trust the ZK proof system

---

## 8. Success Criteria

### 8.1 Functional Success
- SUCCESS-001: 100% of user stories implemented
- SUCCESS-002: All ZK circuits working and verified
- SUCCESS-003: Complete game flow from start to pot distribution
- SUCCESS-004: Statistics accurately tracked and verifiable
- SUCCESS-005: No critical bugs in production

### 8.2 Performance Success
- SUCCESS-006: Proof generation within specified time limits
- SUCCESS-007: Transaction confirmation < 5 seconds average
- SUCCESS-008: UI responsive (< 100ms) for all actions
- SUCCESS-009: Support 50+ concurrent games
- SUCCESS-010: < 1% transaction failure rate

### 8.3 User Experience Success
- SUCCESS-011: 90%+ user satisfaction rating
- SUCCESS-012: < 5% user drop-off during game
- SUCCESS-013: Clear understanding of game state (user testing)
- SUCCESS-014: Intuitive UI (< 2 minutes to learn)
- SUCCESS-015: Positive feedback on fairness and trust

---

## 9. Out of Scope (Future Enhancements)

### 9.1 Not Included in V1
- FUTURE-001: Multi-table tournaments
- FUTURE-002: More than 2 players (3-9 player tables)
- FUTURE-003: Different poker variants (Omaha, Stud, etc.)
- FUTURE-004: Chat functionality
- FUTURE-005: Avatars and customization
- FUTURE-006: Replay hand history
- FUTURE-007: AI opponent
- FUTURE-008: Mobile app (native)
- FUTURE-009: Rake/house edge
- FUTURE-010: Cryptocurrency other than XLM

### 9.2 Potential V2 Features
- Side pots for all-in scenarios
- Tournament mode with blind increases
- Sit-and-go tables
- Cash game tables
- Hand history export
- Advanced statistics and analytics
- Social features (friends, challenges)
- Achievements and badges

---

## 10. Glossary

- **Blind**: Forced bet posted before cards are dealt
- **Burn Card**: Card discarded face-down before dealing community cards
- **Community Cards**: Shared cards visible to all players
- **Dealer Button**: Indicator of dealer position, rotates each hand
- **Flop**: First 3 community cards
- **Hole Cards**: Private cards dealt to each player (2 in Texas Hold'em)
- **Pot**: Total amount of XLM bet in current hand
- **River**: 5th and final community card
- **Showdown**: Final phase where remaining players reveal hands
- **Turn**: 4th community card
- **VRF**: Verifiable Random Function
- **ZK Proof**: Zero-Knowledge Proof, proves statement without revealing information

---

## 11. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-02-18 | Kiro AI | Initial requirements document |

---

## 12. Approval

This requirements document must be reviewed and approved before implementation begins.

**Stakeholders:**
- [ ] Product Owner
- [ ] Technical Lead
- [ ] Security Auditor
- [ ] UX Designer

**Approval Date:** _________________

**Signatures:** _________________
