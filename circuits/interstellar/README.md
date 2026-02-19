# Interstellar ZK Circuits

Zero-Knowledge circuits for the Interstellar 3D shooter game on Stellar blockchain.

## Overview

This directory contains Circom circuits that enable privacy-preserving gameplay for a 2-player shooter game. Players can prove actions without revealing their position, health, or inventory.

## Circuits

### Core Gameplay Circuits

1. **spawn.circom** - Player spawn verification
   - Verifies spawn position is deterministic and valid
   - Ensures players spawn in separate zones
   - ~1K constraints

2. **movement.circom** - Movement validation
   - Proves movement is within speed limits
   - Verifies position stays within map bounds
   - ~5K constraints

3. **shooting.circom** - Shot hit detection
   - Proves bullet trajectory hits target
   - Verifies distance is within weapon range
   - Calculates damage based on weapon type
   - ~10K constraints

4. **damage.circom** - Health update verification
   - Proves health reduction is correct
   - Determines death status
   - ~2K constraints

5. **item_collection.circom** - Item pickup verification
   - Proves player is near item
   - Verifies inventory update
   - ~3K constraints

6. **win_condition.circom** - Victory determination
   - Verifies kill/death counts
   - Determines winner based on kills or survival
   - ~5K constraints

## Setup

### Prerequisites
```bash
# Install Node.js dependencies
npm install

# Install circom compiler
# Follow instructions at: https://docs.circom.io/getting-started/installation/
```

### Build Circuits
```bash
# Compile all circuits
npm run build

# Or compile individual circuit
circom src/spawn.circom --r1cs --wasm --sym -o build/
```

### Generate Trusted Setup
```bash
# Download Powers of Tau ceremony file
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau

# Generate proving and verification keys for each circuit
npm run setup
```

### Generate Proofs
```bash
# Test proof generation
npm run test
```

## Circuit Details

### Spawn Circuit
**Purpose**: Verify player spawns in valid location

**Public Inputs**:
- `player_id`: 0 or 1
- `game_seed`: Shared randomness seed
- `position_commitment`: Poseidon hash of position

**Private Inputs**:
- `spawn_x, spawn_y, spawn_z`: Spawn coordinates
- `salt`: Random salt for commitment

**Outputs**:
- `is_valid`: 1 if spawn is valid

### Movement Circuit
**Purpose**: Verify player movement is valid

**Public Inputs**:
- `old_position_commitment`: Previous position hash
- `new_position_commitment`: New position hash
- `timestamp_delta`: Time since last move

**Private Inputs**:
- `old_x, old_y, old_z, old_salt`: Previous position
- `new_x, new_y, new_z, new_salt`: New position

**Outputs**:
- `is_valid`: 1 if movement is valid

### Shooting Circuit
**Purpose**: Verify shot hit detection

**Public Inputs**:
- `shooter_position_commitment`: Shooter position hash
- `target_position_commitment`: Target position hash
- `weapon_type`: 0=pistol, 1=rifle, 2=shotgun

**Private Inputs**:
- `shooter_x, shooter_y, shooter_z, shooter_salt`: Shooter position
- `dir_x, dir_y, dir_z`: Shot direction
- `target_x, target_y, target_z, target_salt`: Target position

**Outputs**:
- `is_hit`: 1 if shot hits target
- `damage`: Damage amount
- `is_valid`: 1 if proof is valid

### Damage Circuit
**Purpose**: Verify health update after damage

**Public Inputs**:
- `old_health_commitment`: Previous health hash
- `new_health_commitment`: New health hash
- `damage_amount`: Damage taken

**Private Inputs**:
- `old_health, old_salt`: Previous health
- `new_health, new_salt`: New health

**Outputs**:
- `is_dead`: 1 if health reached 0
- `is_valid`: 1 if update is valid

### Item Collection Circuit
**Purpose**: Verify item pickup

**Public Inputs**:
- `player_position_commitment`: Player position hash
- `old_inventory_commitment`: Previous inventory hash
- `new_inventory_commitment`: New inventory hash
- `item_x, item_y, item_z`: Item location
- `item_type`: 0=health, 1=ammo, 2=weapon, 3=powerup
- `item_id`: Unique item identifier

**Private Inputs**:
- `player_x, player_y, player_z, position_salt`: Player position
- `old_*`: Previous inventory state
- `new_*`: New inventory state

**Outputs**:
- `is_valid`: 1 if collection is valid

### Win Condition Circuit
**Purpose**: Determine game winner

**Public Inputs**:
- `stats_commitment`: Hash of all game stats
- `game_duration`: Total game time

**Private Inputs**:
- `player1_kills, player1_deaths, player1_health`: Player 1 stats
- `player2_kills, player2_deaths, player2_health`: Player 2 stats
- `player1_shots_fired, player1_shots_hit`: Player 1 accuracy
- `player2_shots_fired, player2_shots_hit`: Player 2 accuracy
- `salt`: Random salt

**Outputs**:
- `winner`: 1=player1, 2=player2, 0=tie
- `is_valid`: 1 if stats are valid

## Game Flow

1. **Game Start**: Both players generate spawn proofs
2. **Gameplay Loop**:
   - Movement proofs for position updates
   - Item collection proofs for pickups
   - Shooting proofs for attacks
   - Damage proofs for health updates
3. **Game End**: Win condition proof determines winner

## Security

- All position/health/inventory data is kept private via Poseidon commitments
- Proofs are verified on-chain by Soroban contract
- Deterministic randomness prevents prediction attacks
- Range checks prevent invalid values
- Commitment binding prevents cheating

## Integration

The circuits integrate with:
- **Soroban Contract**: Verifies proofs on-chain
- **Frontend**: Generates proofs in browser using snarkjs
- **Game Engine**: Provides private inputs for proof generation

## Development

### Testing
```bash
# Run all tests
npm test

# Test specific circuit
npm test spawn
```

### Optimization
- Use Poseidon hash for efficient commitments
- Minimize constraint count for faster proving
- Batch proofs when possible
- Use lookup tables for common operations

## References

- [Circom Documentation](https://docs.circom.io/)
- [snarkjs](https://github.com/iden3/snarkjs)
- [Poseidon Hash](https://www.poseidon-hash.info/)
- [Groth16 Protocol](https://eprint.iacr.org/2016/260.pdf)
