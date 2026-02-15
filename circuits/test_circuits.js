// Test ZK circuits for Dead Man's Draw
const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

async function testDrawCard() {
    console.log('\n=== Testing Draw Card Circuit ===\n');
    
    // Test 1: Valid draw (no bust)
    console.log('Test 1: Valid draw - Swords 7');
    const input1 = {
        deck_root: "12345678901234567890123456789012",
        card_index: "5",
        current_suits_mask: "0",  // No suits drawn yet
        card_value: "6",  // Card 6 = Swords 7 (suit=0, rank=7)
        path_elements: ["0","0","0","0","0","0"],
        path_indices: ["0","0","0","0","0","0"]
    };
    
    try {
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input1,
            "build/draw_card/draw_card_js/draw_card.wasm",
            "build/draw_card/draw_card_final.zkey"
        );
        
        console.log('✓ Proof generated successfully');
        console.log('Public Signals:');
        console.log('  new_suits_mask:', publicSignals[0], '(binary: 0b' + parseInt(publicSignals[0]).toString(2).padStart(4, '0') + ')');
        console.log('  is_bust:', publicSignals[1]);
        console.log('  card_suit:', publicSignals[2]);
        console.log('  card_rank:', publicSignals[3]);
        
        // Verify proof
        const vkey = JSON.parse(fs.readFileSync("build/draw_card/verification_key.json"));
        const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
        console.log('Verification:', verified ? '✓ PASS' : '✗ FAIL');
        
        // Check outputs
        if (publicSignals[1] === "0" && publicSignals[2] === "0" && publicSignals[3] === "7") {
            console.log('✓ Outputs correct: No bust, Swords (0), Rank 7');
        } else {
            console.log('✗ Outputs incorrect');
        }
    } catch (error) {
        console.error('✗ Test failed:', error.message);
    }
    
    // Test 2: Bust detection
    console.log('\nTest 2: Bust detection - Drawing duplicate suit');
    const input2 = {
        deck_root: "12345678901234567890123456789012",
        card_index: "8",
        current_suits_mask: "1",  // Swords already drawn (0b0001)
        card_value: "7",  // Card 7 = Swords 8 (suit=0, rank=8)
        path_elements: ["0","0","0","0","0","0"],
        path_indices: ["0","0","0","0","0","0"]
    };
    
    try {
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input2,
            "build/draw_card/draw_card_js/draw_card.wasm",
            "build/draw_card/draw_card_final.zkey"
        );
        
        console.log('✓ Proof generated successfully');
        console.log('Public Signals:');
        console.log('  new_suits_mask:', publicSignals[0]);
        console.log('  is_bust:', publicSignals[1]);
        console.log('  card_suit:', publicSignals[2]);
        console.log('  card_rank:', publicSignals[3]);
        
        const vkey = JSON.parse(fs.readFileSync("build/draw_card/verification_key.json"));
        const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
        console.log('Verification:', verified ? '✓ PASS' : '✗ FAIL');
        
        if (publicSignals[1] === "1") {
            console.log('✓ Bust correctly detected');
        } else {
            console.log('✗ Bust not detected');
        }
    } catch (error) {
        console.error('✗ Test failed:', error.message);
    }
    
    // Test 3: Multiple suits
    console.log('\nTest 3: Drawing different suits');
    const input3 = {
        deck_root: "12345678901234567890123456789012",
        card_index: "15",
        current_suits_mask: "3",  // Swords + Coins (0b0011)
        card_value: "25",  // Card 25 = Cups 6 (suit=2, rank=6)
        path_elements: ["0","0","0","0","0","0"],
        path_indices: ["0","0","0","0","0","0"]
    };
    
    try {
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input3,
            "build/draw_card/draw_card_js/draw_card.wasm",
            "build/draw_card/draw_card_final.zkey"
        );
        
        console.log('✓ Proof generated successfully');
        console.log('Public Signals:');
        console.log('  new_suits_mask:', publicSignals[0], '(binary: 0b' + parseInt(publicSignals[0]).toString(2).padStart(4, '0') + ')');
        console.log('  is_bust:', publicSignals[1]);
        console.log('  card_suit:', publicSignals[2]);
        console.log('  card_rank:', publicSignals[3]);
        
        const vkey = JSON.parse(fs.readFileSync("build/draw_card/verification_key.json"));
        const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
        console.log('Verification:', verified ? '✓ PASS' : '✗ FAIL');
        
        // Expected: mask should be 0b0111 (7), no bust, suit=2, rank=6
        if (publicSignals[0] === "7" && publicSignals[1] === "0" && publicSignals[2] === "2" && publicSignals[3] === "6") {
            console.log('✓ Outputs correct: Mask updated to 0b0111, Cups (2), Rank 6');
        } else {
            console.log('✗ Outputs incorrect');
        }
    } catch (error) {
        console.error('✗ Test failed:', error.message);
    }
}

async function testDeckShuffle() {
    console.log('\n=== Testing Deck Shuffle Circuit ===\n');
    
    console.log('Test: Verify shuffled deck is valid permutation');
    
    // Create a shuffled deck (for testing, just reverse order)
    const shuffled = Array.from({length: 40}, (_, i) => 39 - i);
    
    const input = {
        seed1_hash: "11111111111111111111111111111111",
        seed2_hash: "22222222222222222222222222222222",
        seed1: "11111111111111111111111111111111",
        seed2: "22222222222222222222222222222222",
        shuffled_deck: shuffled.map(String)
    };
    
    try {
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input,
            "build/deck_shuffle/deck_shuffle_js/deck_shuffle.wasm",
            "build/deck_shuffle/deck_shuffle_final.zkey"
        );
        
        console.log('✓ Proof generated successfully');
        console.log('Deck root:', publicSignals[0]);
        
        const vkey = JSON.parse(fs.readFileSync("build/deck_shuffle/verification_key.json"));
        const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
        console.log('Verification:', verified ? '✓ PASS' : '✗ FAIL');
        
        if (verified) {
            console.log('✓ Shuffled deck is valid permutation');
        }
    } catch (error) {
        console.error('✗ Test failed:', error.message);
    }
}

async function runAllTests() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   Dead Man\'s Draw - ZK Circuit Test Suite            ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    
    // Check if build artifacts exist
    if (!fs.existsSync('build/draw_card/draw_card_final.zkey')) {
        console.error('\n✗ Error: Circuit not built. Run build_wsl.sh first.');
        console.error('  Then generate proving keys as described in SETUP.md');
        process.exit(1);
    }
    
    await testDrawCard();
    
    if (fs.existsSync('build/deck_shuffle/deck_shuffle_final.zkey')) {
        await testDeckShuffle();
    } else {
        console.log('\n⚠ Skipping deck shuffle test (keys not generated)');
    }
    
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║   Test Suite Complete                                  ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
}

runAllTests().catch(console.error);
