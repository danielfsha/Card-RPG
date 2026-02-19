# Interstellar ZK Circuit Design

## Game Overview
2-player 3D shooter where players:
- Spawn in random positions
- Collect items (weapons, health, ammo, power-ups)
- Fight each other
- Track stats (kills, deaths, items collected, accuracy)
- Determine winner based on kills/survival

## ZK Requirements

### 1. Privacy Needs
- **Player Position**: Hidden until revealed (fog of war)
- **Inventory**: Hidden items/weapons until used
- **Health**: Hidden current health
- **Ammo Count**: Hidden ammunition
- **Item Spawns**: Deterministic but unpredictable

### 2. Verifiable Actions
- **Movement**: Valid position updates
- **Item Collection**: Proof of being at item location
- **Shooting**: Proof of hit/miss with trajectory
- **Damage**: Proof of valid damage calculation
- **Death**: Proof of health reaching zero
- **Win Condition**: Proof of victory (kills, survival time)

## Circuit Architecture

### Core Circuits

#### 1. **game_state.circom** - Main Game State Management
```
Inputs:
- player1_position_commitment (private)
- player2_position_commitment (private)
- player1_health_commitment (private)
- player2_health_commitment (private)
- player1_inventory_commitment (private)
- player2_inventory_commitment (private)
- game_seed (public)
- round_number (public)

Outputs:
- game_state_hash (public)
- is_valid (public)

Verifies:
- All commitments are valid Poseidon hashes
- Game state is consistent
- Round number is sequential
```

#### 2. **spawn.circom** - Player Spawn Verification
```
Inputs:
- player_id (public)
- spawn_seed (private) - derived from game_seed + player_address
- spawn_position_x (private)
- spawn_position_y (private)
- spawn_position_z (private)
- position_commitment (public)

Outputs:
- is_valid_spawn (public)
- position_hash (public)

Verifies:
- Spawn position is deterministically generated from seed
- Position is within valid spawn zones
- Position commitment matches Poseidon(x, y, z, salt)
- No collision with other player's spawn
```

#### 3. **movement.circom** - Movement Validation
```
Inputs:
- old_position_x, old_position_y, old_position_z (private)
- new_position_x, new_position_y, new_position_z (private)
- old_position_commitment (public)
- new_position_commitment (public)
- timestamp_delta (public)
- movement_salt (private)

Outputs:
- is_valid_movement (public)
- new_position_hash (public)

Verifies:
- Old position commitment is valid
- Movement distance is within max_speed * timestamp_delta
- New position is within map bounds
- No wall collisions (using map collision data)
- New position commitment is valid
```

#### 4. **item_collection.circom** - Item Pickup Verification
```
Inputs:
- player_position_x, player_position_y, player_position_z (private)
- item_position_x, item_position_y, item_position_z (public)
- item_type (public) - weapon, health, ammo, powerup
- item_id (public)
- position_commitment (public)
- old_inventory_commitment (public)
- new_inventory_commitment (public)
- inventory_salt (private)

Outputs:
- is_valid_collection (public)
- new_inventory_hash (public)

Verifies:
- Player position is within collection radius of item
- Position commitment is valid
- Item hasn't been collected yet (check item_id in collected_items)
- Inventory update is valid (add item to inventory)
- New inventory commitment is valid
```

#### 5. **shooting.circom** - Shot Validation & Hit Detection
```
Inputs:
- shooter_position_x, shooter_position_y, shooter_position_z (private)
- shooter_direction_x, shooter_direction_y, shooter_direction_z (private)
- target_position_x, target_position_y, target_position_z (private)
- shooter_position_commitment (public)
- target_position_commitment (public)
- weapon_type (public)
- shot_timestamp (public)

Outputs:
- is_hit (public)
- damage_amount (public)
- is_valid_shot (public)

Verifies:
- Shooter position commitment is valid
- Target position commitment is valid
- Ray-sphere collision detection (bullet trajectory hits target hitbox)
- Distance is within weapon range
- Line of sight (no walls between shooter and target)
- Damage calculation based on weapon type and distance
```

#### 6. **damage.circom** - Health Update Verification
```
Inputs:
- old_health (private)
- damage_amount (public)
- new_health (private)
- old_health_commitment (public)
- new_health_commitment (public)
- health_salt (private)

Outputs:
- is_valid_damage (public)
- is_dead (public)
- new_health_hash (public)

Verifies:
- Old health commitment is valid
- new_health = max(0, old_health - damage_amount)
- New health commitment is valid
- is_dead = (new_health == 0)
```

#### 7. **item_spawn.circom** - Deterministic Item Spawning
```
Inputs:
- game_seed (public)
- round_number (public)
- item_index (public)
- spawn_position_x (private)
- spawn_position_y (private)
- spawn_position_z (private)
- item_type (private)

Outputs:
- item_spawn_hash (public)
- is_valid_spawn (public)

Verifies:
- Item position is deterministically generated from:
  hash(game_seed || round_number || item_index)
- Position is within valid item spawn zones
- Item type is randomly selected from available types
- No overlap with player spawn zones
```

#### 8. **win_condition.circom** - Victory Verification
```
Inputs:
- player1_kills (private)
- player2_kills (private)
- player1_deaths (private)
- player2_deaths (private)
- player1_health (private)
- player2_health (private)
- game_duration (public)
- win_condition_type (public) - kills, survival, time

Outputs:
- winner (public) - 1, 2, or 0 (tie)
- is_valid (public)

Verifies:
- Kill counts are consistent with death counts
- Health values are valid (0-100)
- Winner determination based on condition type:
  - KILLS: Most kills wins
  - SURVIVAL: Last player alive wins
  - TIME: Most kills when time expires
- Tie-breaking rules applied
```

#### 9. **stats_aggregation.circom** - Game Statistics
```
Inputs:
- player1_kills (private)
- player1_deaths (private)
- player1_items_collected (private)
- player1_shots_fired (private)
- player1_shots_hit (private)
- player2_kills (private)
- player2_deaths (private)
- player2_items_collected (private)
- player2_shots_fired (private)
- player2_shots_hit (private)
- stats_commitment (public)

Outputs:
- player1_kd_ratio (public)
- player2_kd_ratio (public)
- player1_accuracy (public)
- player2_accuracy (public)
- is_valid (public)

Verifies:
- All stats are non-negative
- KD ratio = kills / max(1, deaths)
- Accuracy = (shots_hit / max(1, shots_fired)) * 100
- Stats commitment matches Poseidon hash of all stats
```

### Helper Circuits

#### 10. **poseidon_commitment.circom** - Commitment Scheme
```
Inputs:
- value1, value2, ..., valueN (private)
- salt (private)

Outputs:
- commitment (public)

Computes:
- commitment = Poseidon(value1, value2, ..., valueN, salt)
```

#### 11. **range_check.circom** - Value Range Validation
```
Inputs:
- value (private)
- min (public)
- max (public)

Outputs:
- is_in_range (public)

Verifies:
- min <= value <= max
```

#### 12. **collision_detection.circom** - Ray-Sphere Intersection
```
Inputs:
- ray_origin_x, ray_origin_y, ray_origin_z (private)
- ray_direction_x, ray_direction_y, ray_direction_z (private)
- sphere_center_x, sphere_center_y, sphere_center_z (private)
- sphere_radius (public)

Outputs:
- is_hit (public)
- hit_distance (public)

Computes:
- Ray-sphere intersection using quadratic formula
- Returns true if ray intersects sphere
```

#### 13. **distance_check.circom** - 3D Distance Calculation
```
Inputs:
- point1_x, point1_y, point1_z (private)
- point2_x, point2_y, point2_z (private)
- max_distance (public)

Outputs:
- is_within_range (public)
- distance (public)

Computes:
- distance = sqrt((x2-x1)² + (y2-y1)² + (z2-z1)²)
- is_within_range = (distance <= max_distance)
```

## Game Flow with ZK Proofs

### Phase 1: Game Start
1. **Spawn Proof**: Each player generates spawn position proof
   - Input: game_seed, player_address
   - Output: position_commitment
   - Submit to contract

### Phase 2: Gameplay Loop
1. **Movement Proof**: Player moves
   - Input: old_position, new_position, timestamp
   - Output: new_position_commitment
   - Submit to contract

2. **Item Collection Proof**: Player collects item
   - Input: player_position, item_position, item_id
   - Output: new_inventory_commitment
   - Submit to contract

3. **Shooting Proof**: Player shoots
   - Input: shooter_position, target_position, weapon
   - Output: is_hit, damage_amount
   - Submit to contract

4. **Damage Proof**: Target takes damage
   - Input: old_health, damage_amount
   - Output: new_health_commitment, is_dead
   - Submit to contract

### Phase 3: Game End
1. **Win Condition Proof**: Determine winner
   - Input: all game stats
   - Output: winner, final_stats
   - Submit to contract
   - Contract calls Game Hub end_game()

## Circuit Complexity Analysis

| Circuit | Constraints | Proof Time | Use Frequency |
|---------|-------------|------------|---------------|
| spawn | ~1K | <1s | Once per player |
| movement | ~5K | ~1s | Every move |
| item_collection | ~3K | <1s | Per item pickup |
| shooting | ~10K | ~2s | Per shot |
| damage | ~2K | <1s | Per hit |
| win_condition | ~5K | ~1s | Once per game |
| stats_aggregation | ~8K | ~2s | Once per game |

## Security Considerations

1. **Replay Protection**: Include nonce/timestamp in all proofs
2. **Commitment Binding**: Use strong salt for all commitments
3. **Range Checks**: Validate all numeric inputs are within bounds
4. **Deterministic Randomness**: Use game_seed + player_address for all RNG
5. **State Consistency**: Verify state transitions are valid
6. **No Information Leakage**: Ensure proofs don't reveal private data

## Implementation Priority

### Phase 1 (MVP):
1. spawn.circom
2. movement.circom
3. shooting.circom
4. damage.circom
5. win_condition.circom

### Phase 2 (Enhanced):
6. item_collection.circom
7. item_spawn.circom
8. stats_aggregation.circom

### Phase 3 (Advanced):
9. Advanced collision detection
10. Power-up effects
11. Weapon variety
12. Team modes

## Contract Integration

The Soroban contract will:
1. Store game state commitments
2. Verify ZK proofs on-chain
3. Update game state based on valid proofs
4. Enforce turn order and timing
5. Determine winner and call Game Hub
6. Track player stats and rankings

## Next Steps

1. Copy poker circuits directory structure
2. Implement core circuits (spawn, movement, shooting, damage, win_condition)
3. Set up trusted setup for each circuit
4. Generate verification keys
5. Integrate with Soroban contract
6. Test proof generation in frontend
7. Optimize circuit constraints
