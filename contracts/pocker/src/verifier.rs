use soroban_sdk::{Bytes, BytesN, Env, Vec, contracttype, contracterror, vec};
use soroban_sdk::crypto::bn254::{Bn254G1Affine, Bn254G2Affine, Fr};

#[contracttype]
#[derive(Clone, Debug)]
pub struct Groth16Proof {
    pub pi_a: BytesN<64>,
    pub pi_b: BytesN<128>,
    pub pi_c: BytesN<64>,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct VerificationKey {
    pub alpha: BytesN<64>,
    pub beta: BytesN<128>,
    pub gamma: BytesN<128>,
    pub delta: BytesN<128>,
    pub ic: Vec<BytesN<64>>,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VerificationError {
    InvalidProofStructure = 1,
    InvalidVerificationKey = 2,
    InvalidPublicInputs = 3,
    InvalidPoint = 4,
    PairingCheckFailed = 5,
}

const BN254_P: [u8; 32] = [
    0x30, 0x64, 0x4e, 0x72, 0xe1, 0x31, 0xa0, 0x29,
    0xb8, 0x50, 0x45, 0xb6, 0x81, 0x81, 0x58, 0x5d,
    0x97, 0x81, 0x6a, 0x91, 0x68, 0x71, 0xca, 0x8d,
    0x3c, 0x20, 0x8c, 0x16, 0xd8, 0x7c, 0xfd, 0x47,
];

pub fn verify_groth16(
    env: &Env,
    vk: &VerificationKey,
    proof: &Groth16Proof,
    public_inputs: &Vec<Bytes>,
) -> Result<bool, VerificationError> {
    if public_inputs.len() + 1 != vk.ic.len() {
        return Err(VerificationError::InvalidPublicInputs);
    }

    let bn254 = env.crypto().bn254();

    let mut vk_x = Bn254G1Affine::from_bytes(vk.ic.get(0).unwrap().clone());

    for i in 0..public_inputs.len() {
        let scalar_bytes = bytes_to_scalar(env, &public_inputs.get(i).unwrap())?;
        let scalar = Fr::from_bytes(scalar_bytes);
        let ic_point = Bn254G1Affine::from_bytes(vk.ic.get(i + 1).unwrap().clone());
        let term = bn254.g1_mul(&ic_point, &scalar);
        vk_x = bn254.g1_add(&vk_x, &term);
    }

    let neg_alpha = negate_g1(env, &Bn254G1Affine::from_bytes(vk.alpha.clone()));
    let neg_vk_x = negate_g1(env, &vk_x);
    let neg_c = negate_g1(env, &Bn254G1Affine::from_bytes(proof.pi_c.clone()));

    let g1_points = vec![
        env,
        Bn254G1Affine::from_bytes(proof.pi_a.clone()),
        neg_alpha,
        neg_vk_x,
        neg_c,
    ];

    let g2_points = vec![
        env,
        Bn254G2Affine::from_bytes(proof.pi_b.clone()),
        Bn254G2Affine::from_bytes(vk.beta.clone()),
        Bn254G2Affine::from_bytes(vk.gamma.clone()),
        Bn254G2Affine::from_bytes(vk.delta.clone()),
    ];

    let result = bn254.pairing_check(g1_points, g2_points);

    if !result {
        return Err(VerificationError::PairingCheckFailed);
    }

    Ok(true)
}

fn negate_g1(env: &Env, point: &Bn254G1Affine) -> Bn254G1Affine {
    let bytes = point.to_array();
    let mut x_bytes = [0u8; 32];
    let mut y_bytes = [0u8; 32];
    x_bytes.copy_from_slice(&bytes[0..32]);
    y_bytes.copy_from_slice(&bytes[32..64]);

    if y_bytes == [0u8; 32] {
        return Bn254G1Affine::from_array(env, &[0u8; 64]);
    }

    let neg_y = field_sub_be(&BN254_P, &y_bytes);
    let mut result = [0u8; 64];
    result[0..32].copy_from_slice(&x_bytes);
    result[32..64].copy_from_slice(&neg_y);

    Bn254G1Affine::from_array(env, &result)
}

fn field_sub_be(a: &[u8; 32], b: &[u8; 32]) -> [u8; 32] {
    let mut result = [0u8; 32];
    let mut borrow: i32 = 0;
    for i in (0..32).rev() {
        let diff = (a[i] as i32) - (b[i] as i32) - borrow;
        if diff < 0 {
            result[i] = (diff + 256) as u8;
            borrow = 1;
        } else {
            result[i] = diff as u8;
            borrow = 0;
        }
    }
    result
}

fn bytes_to_scalar(env: &Env, bytes: &Bytes) -> Result<BytesN<32>, VerificationError> {
    let mut scalar_bytes = [0u8; 32];
    let len = bytes.len().min(32);
    
    for i in 0..len {
        scalar_bytes[i as usize] = bytes.get(i).unwrap_or(0);
    }
    
    Ok(BytesN::from_array(env, &scalar_bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_field_subtraction() {
        let a = [0xFF; 32];
        let b = [0x01; 32];
        let result = field_sub_be(&a, &b);
        assert_eq!(result[31], 0xFE);
    }

    #[test]
    fn test_public_inputs_validation() {
        let env = Env::default();
        
        let proof = Groth16Proof {
            pi_a: BytesN::from_array(&env, &[0u8; 64]),
            pi_b: BytesN::from_array(&env, &[0u8; 128]),
            pi_c: BytesN::from_array(&env, &[0u8; 64]),
        };
        
        let mut vk = VerificationKey {
            alpha: BytesN::from_array(&env, &[0u8; 64]),
            beta: BytesN::from_array(&env, &[0u8; 128]),
            gamma: BytesN::from_array(&env, &[0u8; 128]),
            delta: BytesN::from_array(&env, &[0u8; 128]),
            ic: Vec::new(&env),
        };
        
        vk.ic.push_back(BytesN::from_array(&env, &[0u8; 64]));
        vk.ic.push_back(BytesN::from_array(&env, &[0u8; 64]));
        
        let mut public_inputs = Vec::new(&env);
        public_inputs.push_back(Bytes::from_slice(&env, &[1u8]));
        public_inputs.push_back(Bytes::from_slice(&env, &[2u8]));
        public_inputs.push_back(Bytes::from_slice(&env, &[3u8]));
        
        let result = verify_groth16(&env, &vk, &proof, &public_inputs);
        assert_eq!(result, Err(VerificationError::InvalidPublicInputs));
    }
}
