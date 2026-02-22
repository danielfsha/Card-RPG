//! Groth16 Verifier for BN254 using Stellar Protocol 25 primitives
//!
//! This module implements a production-ready Groth16 proof verifier
//! using Stellar's native BN254 elliptic curve operations.

use soroban_sdk::{
    crypto::bn254::{
        Bn254G1Affine, Bn254G2Affine, Fr, BN254_G1_SERIALIZED_SIZE, BN254_G2_SERIALIZED_SIZE,
    },
    Bytes, Env, Vec, U256,
};

use crate::{Error, Groth16Proof, VerificationKey, ZKProof};

/// Helper function to extract fixed-size byte array from Bytes
fn take<const N: usize>(bytes: &Bytes, pos: &mut u32, err: Error) -> Result<[u8; N], Error> {
    let end = pos.checked_add(N as u32).ok_or(err)?;
    if end > bytes.len() {
        return Err(err);
    }
    let mut arr = [0u8; N];
    bytes.slice(*pos..end).copy_into_slice(&mut arr);
    *pos = end;
    Ok(arr)
}

/// Parse verification key from storage format
pub fn parse_verification_key(env: &Env, vk: &VerificationKey) -> Result<ParsedVK, Error> {
    let alpha = Bn254G1Affine::from_array(
        env,
        &vk.alpha
            .to_array()
            .try_into()
            .map_err(|_| Error::InvalidProofFormat)?,
    );

    let beta = Bn254G2Affine::from_array(
        env,
        &vk.beta
            .to_array()
            .try_into()
            .map_err(|_| Error::InvalidProofFormat)?,
    );

    let gamma = Bn254G2Affine::from_array(
        env,
        &vk.gamma
            .to_array()
            .try_into()
            .map_err(|_| Error::InvalidProofFormat)?,
    );

    let delta = Bn254G2Affine::from_array(
        env,
        &vk.delta
            .to_array()
            .try_into()
            .map_err(|_| Error::InvalidProofFormat)?,
    );

    let mut ic = soroban_sdk::vec![env];
    for ic_point in vk.ic.iter() {
        let g1 = Bn254G1Affine::from_array(
            env,
            &ic_point
                .to_array()
                .try_into()
                .map_err(|_| Error::InvalidProofFormat)?,
        );
        ic.push_back(g1);
    }

    if ic.is_empty() {
        return Err(Error::InvalidProofFormat);
    }

    Ok(ParsedVK {
        alpha,
        beta,
        gamma,
        delta,
        ic,
    })
}

/// Parse proof from ZKProof structure
pub fn parse_proof(env: &Env, proof: &Groth16Proof) -> Result<ParsedProof, Error> {
    // Parse pi_a (G1 point - 64 bytes)
    let a = Bn254G1Affine::from_array(
        env,
        &proof
            .pi_a
            .to_array()
            .try_into()
            .map_err(|_| Error::InvalidProofFormat)?,
    );

    // Parse pi_b (G2 point - 128 bytes)
    let b = Bn254G2Affine::from_array(
        env,
        &proof
            .pi_b
            .to_array()
            .try_into()
            .map_err(|_| Error::InvalidProofFormat)?,
    );

    // Parse pi_c (G1 point - 64 bytes)
    let c = Bn254G1Affine::from_array(
        env,
        &proof
            .pi_c
            .to_array()
            .try_into()
            .map_err(|_| Error::InvalidProofFormat)?,
    );

    Ok(ParsedProof { a, b, c })
}

/// Parse public signals from BytesN<32> array
pub fn parse_public_signals(env: &Env, signals: &Vec<soroban_sdk::BytesN<32>>) -> Vec<Fr> {
    let mut pub_signals = soroban_sdk::vec![env];

    for signal in signals.iter() {
        let u256 = U256::from_be_bytes(env, &Bytes::from_slice(env, &signal.to_array()));
        pub_signals.push_back(Fr::from_u256(u256));
    }

    pub_signals
}

/// Verify Groth16 proof using BN254 pairing check
///
/// Implements the Groth16 verification equation:
/// e(A, B) = e(α, β) · e(IC[0] + Σ(IC[i] · pub[i]), γ) · e(C, δ)
///
/// Which is rearranged for pairing check as:
/// e(-A, B) · e(α, β) · e(vk_x, γ) · e(C, δ) = 1
pub fn verify_groth16_proof(
    env: &Env,
    vk: ParsedVK,
    proof: ParsedProof,
    pub_signals: Vec<Fr>,
) -> Result<bool, Error> {
    // Verify public signals length matches IC length
    if pub_signals.len() + 1 != vk.ic.len() {
        return Err(Error::InvalidProofFormat);
    }

    let bn = env.crypto().bn254();

    // Compute vk_x = IC[0] + Σ(IC[i] · pub_signals[i-1])
    let mut vk_x = vk.ic.get(0).unwrap();

    for (signal, ic_point) in pub_signals.iter().zip(vk.ic.iter().skip(1)) {
        // Multiply IC point by public signal
        let prod = bn.g1_mul(&ic_point, &signal);
        // Add to accumulator
        vk_x = bn.g1_add(&vk_x, &prod);
    }

    // Negate proof.a for pairing check
    let neg_a = -proof.a;

    // Prepare pairing check inputs
    // Left side: [-A, α, vk_x, C]
    let vp1 = soroban_sdk::vec![env, neg_a, vk.alpha, vk_x, proof.c];

    // Right side: [B, β, γ, δ]
    let vp2 = soroban_sdk::vec![env, proof.b, vk.beta, vk.gamma, vk.delta];

    // Perform pairing check
    // Returns true if e(-A, B) · e(α, β) · e(vk_x, γ) · e(C, δ) = 1
    Ok(bn.pairing_check(vp1, vp2))
}

/// Parsed verification key with native BN254 types
pub struct ParsedVK {
    pub alpha: Bn254G1Affine,
    pub beta: Bn254G2Affine,
    pub gamma: Bn254G2Affine,
    pub delta: Bn254G2Affine,
    pub ic: Vec<Bn254G1Affine>,
}

/// Parsed proof with native BN254 types
pub struct ParsedProof {
    pub a: Bn254G1Affine,
    pub b: Bn254G2Affine,
    pub c: Bn254G1Affine,
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::BytesN as _, BytesN, Env};

    #[test]
    fn test_parse_verification_key() {
        let env = Env::default();

        // Create mock verification key
        let vk = VerificationKey {
            alpha: BytesN::from_array(&env, &[0u8; 64]),
            beta: BytesN::from_array(&env, &[0u8; 128]),
            gamma: BytesN::from_array(&env, &[0u8; 128]),
            delta: BytesN::from_array(&env, &[0u8; 128]),
            ic: soroban_sdk::vec![
                &env,
                BytesN::from_array(&env, &[0u8; 64]),
                BytesN::from_array(&env, &[0u8; 64])
            ],
        };

        let result = parse_verification_key(&env, &vk);
        assert!(result.is_ok());

        let parsed = result.unwrap();
        assert_eq!(parsed.ic.len(), 2);
    }

    #[test]
    fn test_parse_proof() {
        let env = Env::default();

        let proof = Groth16Proof {
            pi_a: BytesN::from_array(&env, &[0u8; 64]),
            pi_b: BytesN::from_array(&env, &[0u8; 128]),
            pi_c: BytesN::from_array(&env, &[0u8; 64]),
        };

        let result = parse_proof(&env, &proof);
        assert!(result.is_ok());
    }

    #[test]
    fn test_parse_public_signals() {
        let env = Env::default();

        let signals = soroban_sdk::vec![
            &env,
            BytesN::from_array(&env, &[1u8; 32]),
            BytesN::from_array(&env, &[2u8; 32]),
        ];

        let parsed = parse_public_signals(&env, &signals);
        assert_eq!(parsed.len(), 2);
    }
}
