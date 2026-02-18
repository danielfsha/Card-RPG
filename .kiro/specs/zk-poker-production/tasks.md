# Implementation Plan: ZK Poker Production

## Overview

This implementation plan builds a production-grade Texas Hold'em poker game on Stellar using Protocol 25 (X-Ray) for on-chain ZK proof verification. The plan extends the existing poker implementation in `pocker/` with multi-round betting, community cards, enhanced circuits, and player statistics.

**Key Technologies:**
- Soroban smart contracts (Rust) with Protocol 25 BN254/Poseidon primitives
- Circom circuits for ZK proofs (6 circuits total)
- React + TypeScript frontend (building on existing `pocker/` implementation)
- Playroom Kit for P2P state synchronization

**Implementation Strategy:**
- Build incrementally, testing each component
- Leverage existing poker UI and contract structure
- Focus on core functionality (no CI/CD, simple UI)
- Test circuits, contracts, and UI integration manually

## Tasks

- [ ] 1. Set up enhanced circuit infrastructure
  - Create circuit directory structure for 6 new circuits
  - Set up build scripts for circuit compilation
  - Configure trusted setup for Groth16 proofs
  - _Requirements: TR-001, TR-002, TR-003, TR-004, TR-005, TR-006_

- [ ] 2. Implement VRF circuit for dealer selection
  - [ ] 2.1 Create `vrf.circom` circuit
    - Implement Poseidon hash of two player seeds
    - Extract random bit (0 or 1) for dealer button
    - Verify circuit compiles (~1K constraints)
    - _Requirements: 3.2, 3.3, TR-001_
  
  - [ ]* 2.2 Write property test for VRF circuit
    - **Property 3: Dealer Selection Determinism**
    - **Property 61: VRF Output Range**
    - **Validates: Requirements 3.2, 3.3**
  
  - [ ]* 2.3 Write unit tests for VRF circuit
    - Test specific seed pairs produce expected output
    - Test output is always 0 or 1
    - Test determinism (same seeds = same output)
    - _Requirements: 3.2, 3.3_

- [ ] 3. Implement deck shuffle circuit
  - [ ] 3.1 Create `shuffle.circom` circuit
    - Implement permutation application logic
    - Add uniqueness checks (all 52 cards present once)
    - Add duplicate detection (pairwise comparisons)
    - Generate Poseidon commitment to shuffled deck
    - Verify circuit compiles (~50K constraints)
    - _Requirements: 6.1, 6.2, 6.3, TR-002_
  
  - [ ]* 3.2 Write property test for shuffle circuit
    - **Property 12: Shuffle Permutation Validity**
    - **Property 62: Shuffle Commitment Binding**
    - **Validates: Requirements 6.3, 6.2**
  
  - [ ]* 3.3 Write unit tests for shuffle circuit
    - Test valid permutation produces valid shuffle
    - Test all 52 cards present exactly once
    - Test no duplicate cards
    - Test identity permutation
    - _Requirements: 6.3_



- [ ] 4. Implement card deal circuit
  - [ ] 4.1 Create `deal.circom` circuit
    - Implement card extraction from shuffled deck
    - Verify deal positions are sequential (0-8)
    - Generate commitments for hole cards and community cards
    - Verify circuit compiles (~10K constraints)
    - _Requirements: 7.1, 7.2, 8.1, 8.3, TR-003_
  
  - [ ]* 4.2 Write property test for deal circuit
    - **Property 14: Hole Cards Dealing**
    - **Property 15: Deal from Shuffled Deck**
    - **Property 16: Community Cards Commitment**
    - **Validates: Requirements 7.1, 7.2, 8.1**
  
  - [ ]* 4.3 Write unit tests for deal circuit
    - Test dealing from specific deck produces expected cards
    - Test 9 cards dealt (2+2+5)
    - Test cards come from positions 0-8
    - _Requirements: 7.1, 7.2_

- [ ] 5. Implement betting validation circuit
  - [ ] 5.1 Create `bet.circom` circuit
    - Implement sufficient funds check
    - Implement minimum bet validation
    - Implement raise validation (2x previous bet)
    - Verify circuit compiles (~500 constraints)
    - _Requirements: 9.4, 10.5, 13.2, TR-004_
  
  - [ ]* 5.2 Write property test for betting circuit
    - **Property 19: Minimum Bet Validation**
    - **Property 23: Raise Minimum Validation**
    - **Property 64: Betting Circuit Validation**
    - **Validates: Requirements 9.4, 10.5, 13.2**
  
  - [ ]* 5.3 Write unit tests for betting circuit
    - Test valid bet with sufficient funds passes
    - Test bet with insufficient funds fails
    - Test bet below minimum fails
    - Test raise below 2x fails
    - Test all-in bet (amount = stack)
    - _Requirements: 9.4, 13.2_

- [ ] 6. Implement community card reveal circuit
  - [ ] 6.1 Create `reveal.circom` circuit
    - Implement commitment verification
    - Implement card decryption/reveal logic
    - Verify revealed card matches commitment
    - Verify circuit compiles (~2K constraints)
    - _Requirements: 8.5, 14.3, TR-005_
  
  - [ ]* 6.2 Write property test for reveal circuit
    - **Property 17: Community Card Reveal Round-Trip**
    - **Property 65: Reveal Proof Matching**
    - **Validates: Requirements 8.5, 14.3**
  
  - [ ]* 6.3 Write unit tests for reveal circuit
    - Test revealing specific card matches commitment
    - Test mismatched card fails verification
    - Test revealing first card (index 0)
    - Test revealing last card (index 4)
    - _Requirements: 14.3_

- [ ] 7. Enhance hand ranking circuit
  - [ ] 7.1 Extend `poker_game.circom` with full hand evaluation
    - Implement all 10 hand type checkers (royal flush through high card)
    - Implement best 5-card selection from 7 cards
    - Implement kicker comparison for tie-breaking
    - Implement winner determination logic
    - Verify circuit compiles (~100K constraints)
    - _Requirements: 17.2, 17.4, 17.5, 18.3, TR-006_
  
  - [ ]* 7.2 Write property test for hand ranking circuit
    - **Property 30: Best Hand Selection**
    - **Property 31: Hand Ranking Correctness**
    - **Property 32: Kicker Tie-Breaking**
    - **Validates: Requirements 17.2, 17.4, 17.5**
  
  - [ ]* 7.3 Write unit tests for hand ranking circuit
    - Test royal flush correctly identified
    - Test straight flush correctly identified
    - Test four of a kind correctly identified
    - Test full house correctly identified
    - Test flush correctly identified
    - Test straight correctly identified
    - Test three of a kind correctly identified
    - Test two pair correctly identified
    - Test one pair correctly identified
    - Test high card correctly identified
    - Test wheel straight (A-2-3-4-5)
    - Test ace-high straight (10-J-Q-K-A)
    - Test kicker tie-breaking
    - _Requirements: 17.4, 17.5_

- [ ] 8. Checkpoint - Verify all circuits compile and test
  - Ensure all 6 circuits compile successfully
  - Run all circuit tests (unit and property tests)
  - Verify constraint counts are within expected ranges
  - Generate proving and verification keys for all circuits
  - Ask the user if questions arise



- [ ] 9. Enhance contract with multi-round game state
  - [ ] 9.1 Update GameState struct with new fields
    - Add phase enum (Setup, Blinds, Shuffle, Deal, Preflop, Flop, Turn, River, Showdown, Complete)
    - Add dealer_button, player stacks, current bets, pot
    - Add community_cards vector, deck_commitment
    - Add current_actor, last_action, last_raise_amount
    - _Requirements: 4.1, 4.2, 5.4, 9.1, TR-007, TR-009_
  
  - [ ] 9.2 Implement Action enum
    - Define Fold, Check, Call, Bet(i128), Raise(i128), AllIn variants
    - _Requirements: 9.2, 10.2, TR-008_
  
  - [ ] 9.3 Add PlayerStats struct
    - Define games_played, games_won, total_winnings, biggest_pot, current_streak
    - _Requirements: 22.1, 22.2, 22.4, 22.5, 22.6, TR-010_
  
  - [ ]* 9.4 Write unit tests for data structures
    - Test GameState initialization
    - Test Action enum variants
    - Test PlayerStats initialization
    - _Requirements: TR-007, TR-008, TR-010_

- [ ] 10. Implement enhanced contract methods
  - [ ] 10.1 Update start_game method
    - Add dealer_button parameter
    - Add VRF proof verification
    - Initialize game in Setup phase
    - Store initial stacks equal to points
    - _Requirements: 3.1, 3.2, 3.3, TR-011_
  
  - [ ] 10.2 Implement post_blinds method
    - Determine small blind and big blind based on dealer button
    - Deduct 0.1 XLM from small blind stack
    - Deduct 0.2 XLM from big blind stack
    - Add blinds to pot
    - Transition to Shuffle phase
    - _Requirements: 4.1, 4.2, 4.4, TR-011_
  
  - [ ] 10.3 Implement commit_shuffle method
    - Accept shuffle proof and public signals
    - Verify shuffle proof using Protocol 25
    - Store shuffle commitment
    - Track which players have shuffled
    - Transition to Deal phase when both shuffled
    - _Requirements: 6.1, 6.2, 6.4, TR-011_
  
  - [ ] 10.4 Implement deal_cards method
    - Accept deal proof and public signals
    - Verify deal proof using Protocol 25
    - Store hole card commitments
    - Store community card commitment
    - Transition to Preflop phase
    - _Requirements: 7.1, 7.2, 8.1, TR-011_
  
  - [ ]* 10.5 Write unit tests for game initialization
    - Test start_game with valid VRF proof
    - Test post_blinds deducts correct amounts
    - Test commit_shuffle verifies proofs
    - Test deal_cards stores commitments
    - Test phase transitions
    - _Requirements: 3.1, 4.1, 6.1, 7.1_

- [ ] 11. Implement betting action methods
  - [ ] 11.1 Implement player_action method
    - Validate it's player's turn
    - Validate action is legal in current phase
    - For Bet/Raise: verify ZK proof of validity
    - Update player stack and current bet
    - Update pot
    - Update last_action and current_actor
    - Check if betting round is complete
    - _Requirements: 9.1, 9.2, 9.4, 9.5, 9.6, 10.2, 10.3, 10.5, TR-011_
  
  - [ ] 11.2 Implement betting round completion logic
    - Check if both players have acted
    - Check if bets are equal or someone folded
    - Transition to next phase if complete
    - _Requirements: 9.6, 10.6_
  
  - [ ] 11.3 Implement fold handling
    - Determine winner (opponent)
    - Transition to Complete phase
    - Skip showdown
    - _Requirements: 19.1, 19.2, 19.4_
  
  - [ ]* 11.4 Write property test for betting actions
    - **Property 8: Stack Decrease on Betting**
    - **Property 20: Pot Update Atomicity**
    - **Property 21: Betting Round Completion**
    - **Validates: Requirements 5.4, 9.5, 9.6**
  
  - [ ]* 11.5 Write unit tests for betting actions
    - Test fold action
    - Test check action (when no bet)
    - Test call action
    - Test bet action with proof
    - Test raise action with proof
    - Test all-in action
    - Test invalid actions are rejected
    - _Requirements: 9.1, 9.2, 10.2_



- [ ] 12. Implement community card reveal methods
  - [ ] 12.1 Implement reveal_community method
    - Accept phase parameter (Flop, Turn, River)
    - Accept reveal proof and public signals
    - Verify reveal proof using Protocol 25
    - For Flop: reveal 3 cards, burn 1
    - For Turn: reveal 1 card, burn 1
    - For River: reveal 1 card, burn 1
    - Add revealed cards to community_cards vector
    - Transition to next betting phase
    - _Requirements: 14.1, 14.2, 15.1, 15.2, 16.1, 16.2, TR-011_
  
  - [ ]* 12.2 Write property test for community reveals
    - **Property 26: Flop Burn and Reveal**
    - **Property 27: Turn Burn and Reveal**
    - **Property 28: River Burn and Reveal**
    - **Property 29: Complete Community Cards After River**
    - **Validates: Requirements 14.1, 14.2, 15.1, 15.2, 16.1, 16.2, 16.4**
  
  - [ ]* 12.3 Write unit tests for community reveals
    - Test flop reveals 3 cards
    - Test turn reveals 1 card (total 4)
    - Test river reveals 1 card (total 5)
    - Test revealed cards match commitment
    - _Requirements: 14.2, 15.2, 16.2_

- [ ] 13. Implement showdown and winner determination
  - [ ] 13.1 Update reveal_winner method
    - Accept hand ranking proof and public signals
    - Verify proof using Protocol 25
    - Extract player1_ranking, player2_ranking, winner from signals
    - Verify commitments match
    - Determine winner from proof
    - Store winner in game state
    - Transition to Complete phase
    - _Requirements: 18.2, 18.3, 18.4, 18.5, TR-011_
  
  - [ ] 13.2 Implement claim_pot method
    - Verify caller is winner
    - Transfer pot to winner
    - Update winner's stack
    - Reset pot to 0
    - _Requirements: 20.1, 20.2, 20.3, 20.5, 21.3, TR-011_
  
  - [ ]* 13.3 Write property test for winner determination
    - **Property 33: Hand Ranking Proof Structure**
    - **Property 34: Proof Verification**
    - **Property 35: Winner Extraction**
    - **Property 9: Winner Stack Increase**
    - **Property 11: Pot Reset After Distribution**
    - **Validates: Requirements 18.3, 18.4, 18.5, 5.5, 20.5**
  
  - [ ]* 13.4 Write unit tests for showdown
    - Test valid hand ranking proof accepted
    - Test invalid proof rejected
    - Test winner receives pot
    - Test pot resets to 0
    - Test winner extracted correctly
    - _Requirements: 18.4, 18.5, 20.1, 20.5_

- [ ] 14. Implement player statistics
  - [ ] 14.1 Implement update_stats internal method
    - Get or initialize player stats
    - Increment games_played
    - If won: increment games_won, add to total_winnings, update biggest_pot, update streak
    - If lost: update streak
    - Store updated stats in persistent storage
    - _Requirements: 22.1, 22.2, 22.4, 22.5, 22.6, TR-011_
  
  - [ ] 14.2 Implement get_stats method
    - Query stats for given player address
    - Return PlayerStats struct
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 24.3, TR-011_
  
  - [ ] 14.3 Call update_stats in end_game flow
    - Update stats for both players after game completion
    - Ensure atomic update (both succeed or both fail)
    - _Requirements: 23.2_
  
  - [ ]* 14.4 Write property test for statistics
    - **Property 41: Games Played Increment**
    - **Property 42: Games Won Increment**
    - **Property 44: Total Winnings Accumulation**
    - **Property 45: Biggest Pot Tracking**
    - **Property 46: Win Streak Increment**
    - **Property 47: Loss Streak Decrement**
    - **Property 50: Statistics Monotonicity**
    - **Validates: Requirements 22.1, 22.2, 22.4, 22.5, 22.6, 23.4**
  
  - [ ]* 14.5 Write unit tests for statistics
    - Test first game initializes stats
    - Test winning game updates stats correctly
    - Test losing game updates stats correctly
    - Test biggest pot updates when exceeded
    - Test streak increments on win
    - Test streak decrements on loss
    - _Requirements: 22.1, 22.2, 22.4, 22.5, 22.6_

- [ ] 15. Checkpoint - Verify contract builds and tests pass
  - Build contract with `bun run build pocker`
  - Run all contract tests with `cargo test`
  - Verify all tests pass
  - Verify contract follows Game Hub pattern
  - Ask the user if questions arise



- [ ] 16. Implement ZK service for proof generation
  - [ ] 16.1 Create ZKService class in `pocker/src/services/zkService.ts`
    - Implement Web Worker setup for non-blocking proof generation
    - Implement generateVRFProof method
    - Implement generateShuffleProof method
    - Implement generateDealProof method
    - Implement generateBetProof method
    - Implement generateRevealProof method
    - Implement generateHandRankingProof method
    - Add progress tracking and error handling
    - _Requirements: TR-013_
  
  - [ ] 16.2 Create Web Worker for proof generation
    - Create `pocker/src/workers/zkWorker.ts`
    - Implement proof generation for each circuit type
    - Load WASM and zkey files
    - Use snarkjs for proof generation
    - Return proof and public signals
    - _Requirements: TR-013_
  
  - [ ]* 16.3 Write unit tests for ZK service
    - Test VRF proof generation
    - Test shuffle proof generation
    - Test deal proof generation
    - Test bet proof generation
    - Test reveal proof generation
    - Test hand ranking proof generation
    - Test error handling
    - _Requirements: TR-013_

- [ ] 17. Enhance poker service with new contract methods
  - [ ] 17.1 Update PockerService in `pocker/src/services/pockerService.ts`
    - Update startGame to include VRF proof
    - Add postBlinds method
    - Add commitShuffle method
    - Add dealCards method
    - Update playerAction to include bet proofs
    - Add revealCommunity method
    - Update revealWinner to use hand ranking proof
    - Add claimPot method
    - Add getStats method
    - _Requirements: TR-014_
  
  - [ ]* 17.2 Write unit tests for poker service
    - Test all contract method calls
    - Test transaction building
    - Test error handling
    - _Requirements: TR-014_

- [ ] 18. Implement Playroom integration for P2P sync
  - [ ] 18.1 Create PlayroomSync class in `pocker/src/services/playroomSync.ts`
    - Implement broadcastAction method
    - Implement onOpponentAction listener
    - Implement shareDecryptionKey method
    - Implement waitForOpponentKey method
    - Add disconnect/reconnect handling
    - _Requirements: TR-015_
  
  - [ ]* 18.2 Write unit tests for Playroom sync
    - Test action broadcasting
    - Test action receiving
    - Test key sharing
    - Test disconnect handling
    - _Requirements: TR-015_

- [ ] 19. Update game state management
  - [ ] 19.1 Enhance GameContext in `pocker/src/hooks/useGameEngine.tsx`
    - Add multi-round phase tracking
    - Add community cards state
    - Add betting history state
    - Add current actor tracking
    - Add dealer button tracking
    - Add player statistics state
    - _Requirements: TR-012_
  
  - [ ] 19.2 Implement phase transition logic
    - Implement transitions for all game phases
    - Validate phase transitions
    - Update UI based on current phase
    - _Requirements: TR-012_
  
  - [ ] 19.3 Implement betting round state management
    - Track current bets for each player
    - Track pot accumulation
    - Determine when betting round is complete
    - _Requirements: TR-012_

- [ ] 20. Implement community cards UI component
  - [ ] 20.1 Create CommunityCards component
    - Display 5 card slots side-by-side (simple layout)
    - Show card backs for unrevealed cards
    - Show card faces for revealed cards
    - Update as cards are revealed (flop: 3, turn: 1, river: 1)
    - Use existing card components from `pocker/src/components/`
    - _Requirements: 14.4, 15.4, 16.4, UI-003_
  
  - [ ] 20.2 Integrate CommunityCards into PokerTable
    - Add CommunityCards component to center of table
    - Position between player areas
    - _Requirements: UI-001, UI-003_

- [ ] 21. Implement betting controls UI
  - [ ] 21.1 Update GameControls component
    - Add Fold button
    - Add Check button (enabled when no bet)
    - Add Call button (enabled when bet exists)
    - Add Bet/Raise slider and button
    - Add All-In button
    - Enable/disable based on current turn
    - Show current bet to call
    - _Requirements: 9.2, 10.2, UI-004_
  
  - [ ] 21.2 Implement betting action handlers
    - Handle fold action
    - Handle check action
    - Handle call action
    - Handle bet/raise action (generate proof)
    - Handle all-in action
    - Show loading state during proof generation
    - _Requirements: 9.1, 9.2, 13.5_



- [ ] 22. Implement game phase indicators
  - [ ] 22.1 Create PhaseIndicator component
    - Display current phase (Preflop, Flop, Turn, River, Showdown)
    - Highlight active phase
    - Show phase transitions
    - _Requirements: 25.1, UI-001_
  
  - [ ] 22.2 Create TurnIndicator component
    - Show whose turn it is
    - Display "Your Turn" or "Waiting for opponent"
    - Highlight active player
    - _Requirements: 26.1, 26.2, 26.3_
  
  - [ ] 22.3 Integrate indicators into GameScreen
    - Add PhaseIndicator to top of screen
    - Add TurnIndicator near active player
    - _Requirements: 25.1, 26.1_

- [ ] 23. Implement betting history display
  - [ ] 23.1 Create BettingHistory component
    - Display list of all actions in current hand
    - Format: "Player1 raises to 0.4 XLM"
    - Show actions in chronological order
    - Clear history at start of new hand
    - _Requirements: 28.1, 28.4, UI-005_
  
  - [ ] 23.2 Integrate BettingHistory into GameScreen
    - Add BettingHistory panel to side of table
    - Update on each action
    - _Requirements: 28.1_

- [ ] 24. Implement player statistics display
  - [ ] 24.1 Create PlayerStats component
    - Display games played, games won, win rate
    - Display total winnings, biggest pot
    - Display current streak
    - Fetch stats from contract
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, UI-009_
  
  - [ ] 24.2 Add stats to player areas
    - Show player's own stats in bottom area
    - Show opponent's stats in top area
    - Update after each game
    - _Requirements: 24.1, 24.2, 24.3_

- [ ] 25. Implement pot claiming UI
  - [ ] 25.1 Create ClaimPot button
    - Show button for winner after game complete
    - Display pot amount on button
    - Handle claim transaction
    - Show success message after claim
    - _Requirements: 21.1, 21.2, 21.3, 21.5_
  
  - [ ] 25.2 Integrate ClaimPot into GameScreen
    - Show button in center when game complete
    - Hide after pot claimed
    - _Requirements: 21.1_

- [ ] 26. Implement dealer button indicator
  - [ ] 26.1 Create DealerButton component
    - Display "D" button indicator
    - Position near dealer player
    - Update when dealer rotates
    - _Requirements: 1.4, 3.5_
  
  - [ ] 26.2 Integrate DealerButton into player areas
    - Show near player with dealer button
    - Update after each hand
    - _Requirements: 1.4_

- [ ] 27. Implement game flow orchestration
  - [ ] 27.1 Implement dealer selection flow
    - Both players generate random seeds
    - Generate VRF proof
    - Submit to contract
    - Display dealer button assignment
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ] 27.2 Implement blinds posting flow
    - Automatically post blinds based on dealer position
    - Update stacks and pot
    - Transition to shuffle phase
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [ ] 27.3 Implement shuffle flow
    - Each player generates shuffle permutation
    - Generate shuffle proof
    - Submit to contract
    - Wait for both players to shuffle
    - _Requirements: 6.1, 6.2, 6.4_
  
  - [ ] 27.4 Implement deal flow
    - Generate deal proof
    - Submit to contract
    - Decrypt own hole cards
    - Display hole cards to player
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ] 27.5 Implement betting round flow
    - Handle player actions
    - Generate proofs for bets/raises
    - Update UI after each action
    - Transition to next phase when round complete
    - _Requirements: 9.1, 9.2, 9.6_
  
  - [ ] 27.6 Implement community reveal flow
    - Generate reveal proof for flop (3 cards)
    - Generate reveal proof for turn (1 card)
    - Generate reveal proof for river (1 card)
    - Update community cards display
    - _Requirements: 14.1, 14.2, 15.1, 15.2, 16.1, 16.2_
  
  - [ ] 27.7 Implement showdown flow
    - Both players share decryption keys via Playroom
    - Generate hand ranking proof
    - Submit to contract
    - Display winner
    - Show claim pot button
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [ ] 28. Implement error handling and user feedback
  - [ ] 28.1 Create ErrorHandler utility
    - Handle contract errors with user-friendly messages
    - Handle proof generation errors
    - Handle network errors
    - _Requirements: Error handling section_
  
  - [ ] 28.2 Add loading states
    - Show loading during proof generation
    - Show loading during transaction submission
    - Show progress for long operations
    - _Requirements: NFR-005_
  
  - [ ] 28.3 Add success/error toasts
    - Show success message after successful actions
    - Show error message on failures
    - Show informative messages for game events
    - _Requirements: 21.5_

- [ ] 29. Generate and integrate contract bindings
  - [ ] 29.1 Build contract
    - Run `bun run build pocker`
    - Verify contract builds successfully
    - _Requirements: Bindings section_
  
  - [ ] 29.2 Generate bindings
    - Run `bun run bindings pocker`
    - Copy generated bindings to `pocker/src/games/pocker/bindings.ts`
    - _Requirements: Bindings section_
  
  - [ ] 29.3 Update service to use new bindings
    - Update PockerService to use new contract methods
    - Test all contract interactions
    - _Requirements: Bindings section_

- [ ] 30. Final integration and testing
  - [ ] 30.1 Test complete game flow
    - Create room and join
    - Complete dealer selection
    - Post blinds
    - Shuffle deck
    - Deal cards
    - Complete preflop betting
    - Reveal flop and bet
    - Reveal turn and bet
    - Reveal river and bet
    - Complete showdown
    - Claim pot
    - Verify statistics updated
    - _Requirements: All user stories_
  
  - [ ] 30.2 Test fold scenarios
    - Test fold in preflop
    - Test fold in flop
    - Test fold in turn
    - Test fold in river
    - Verify winner receives pot
    - _Requirements: 19.1, 19.2, 19.4_
  
  - [ ] 30.3 Test edge cases
    - Test all-in scenarios
    - Test minimum bets
    - Test maximum raises
    - Test check/call sequences
    - Test multiple raises
    - _Requirements: 11.3, 10.4, 10.5_
  
  - [ ] 30.4 Test UI displays correctly
    - Verify community cards display side-by-side
    - Verify betting controls work
    - Verify phase indicators update
    - Verify statistics display
    - Verify pot and stacks update
    - _Requirements: UI requirements_
  
  - [ ] 30.5 Test Protocol 25 integration
    - Verify all proofs verified on-chain
    - Verify Poseidon commitments work
    - Verify BN254 operations work
    - _Requirements: Protocol 25 integration_

- [ ] 31. Final checkpoint - Complete game verification
  - Ensure all circuits compile and tests pass
  - Ensure contract builds and tests pass
  - Ensure UI works and displays correctly
  - Play a complete game from start to finish
  - Verify all features work as expected
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Focus on core functionality: circuits work, contract works, UI displays correctly
- No CI/CD setup required - manual testing is sufficient
- Community cards should be simple side-by-side layout using existing card components
- Build on existing `pocker/` implementation where possible

