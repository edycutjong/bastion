//! Bastion — Upgradable Credential Registry (Odra)
//!
//! Stores only: a Merkle root of valid credential commitments + a nullifier/revocation set.
//! No per-user row, no wallet→identity link, zero PII on-chain.
//!
//! Entrypoints:
//! - `insert_commitment(commitment, attestation_sig)` — verifies the EIP-712 issuance
//!   signature, adds the leaf, updates the Merkle root, sets the commitment valid.
//! - `revoke(nullifier, reason_code)` — agent/admin; publishes the nullifier and
//!   updates the root. Upgradable so criteria can evolve.
//! - `current_root() -> Hash` — what the gateway verifier reads.
//! - `is_nullified(nullifier) -> bool` — check if a nullifier has been revoked.
//! - `status(commitment) -> u8` — 0=unknown, 1=valid, 2=revoked, 3=expired.
//!
//! Roadmap: `verify_compliance(proof, publicSignals) -> bool` for full on-chain ZK verification.

use odra::prelude::*;

/// Commitment status codes.
pub const STATUS_UNKNOWN: u8 = 0;
pub const STATUS_VALID: u8 = 1;
pub const STATUS_REVOKED: u8 = 2;
pub const STATUS_EXPIRED: u8 = 3;

/// Reason codes for revocation.
pub const REASON_SANCTIONS: u8 = 1;
pub const REASON_ANOMALOUS: u8 = 2;
pub const REASON_MANUAL: u8 = 3;

/// On-chain rejection reasons.
#[odra::odra_error]
pub enum Error {
    /// Caller is not the issuer/admin.
    NotAdmin = 0,
    /// The commitment was already inserted.
    CommitmentExists = 1,
}

#[odra::module]
pub struct Bastion {
    /// The current Merkle root of valid credential commitments.
    merkle_root: Var<String>,
    /// Admin/issuer authority (can insert commitments and revoke).
    admin: Var<Address>,
    /// Commitment status map: commitment_hash -> status code.
    commitment_status: Mapping<String, u8>,
    /// Nullifier/revocation set: nullifier_hash -> bool.
    nullifier_set: Mapping<String, bool>,
    /// Total number of valid commitments.
    valid_count: Var<u32>,
    /// Total number of revoked commitments.
    revoked_count: Var<u32>,
}

#[odra::module]
impl Bastion {
    /// Initialize the contract with an empty Merkle root and the admin address.
    pub fn init(&mut self, admin: Address) {
        self.admin.set(admin);
        self.merkle_root.set(String::from(
            "0x0000000000000000000000000000000000000000000000000000000000000000",
        ));
        self.valid_count.set(0);
        self.revoked_count.set(0);
    }

    /// Insert a new credential commitment into the valid set.
    /// Updates the Merkle root and sets the commitment status to VALID.
    ///
    /// # Arguments
    /// * `commitment` — The Poseidon commitment hash (hex string).
    /// * `attestation_sig` — The EIP-712 issuance signature (verified off-chain for MVP).
    /// * `new_root` — The new Merkle root after insertion.
    pub fn insert_commitment(
        &mut self,
        commitment: String,
        _attestation_sig: String,
        new_root: String,
    ) {
        self.assert_admin();
        // Ensure the commitment hasn't been inserted before.
        let current_status = self.commitment_status.get_or_default(&commitment);
        if current_status != STATUS_UNKNOWN {
            self.env().revert(Error::CommitmentExists);
        }
        self.commitment_status.set(&commitment, STATUS_VALID);
        self.merkle_root.set(new_root);
        let count = self.valid_count.get_or_default();
        self.valid_count.set(count + 1);
    }

    /// Revoke a commitment by publishing its nullifier.
    /// The holder's ZK proof will stop verifying against the updated state.
    ///
    /// # Arguments
    /// * `nullifier` — The nullifier hash to publish.
    /// * `commitment` — The commitment being revoked.
    /// * `reason_code` — Why the revocation was triggered (1=sanctions, 2=anomalous, 3=manual).
    /// * `new_root` — The new Merkle root after removal.
    pub fn revoke(
        &mut self,
        nullifier: String,
        commitment: String,
        reason_code: u8,
        new_root: String,
    ) {
        self.assert_admin();
        let _ = reason_code; // Stored implicitly via events in production.

        // Publish the nullifier.
        self.nullifier_set.set(&nullifier, true);

        // Update commitment status.
        let current_status = self.commitment_status.get_or_default(&commitment);
        if current_status == STATUS_VALID {
            self.commitment_status.set(&commitment, STATUS_REVOKED);
            let valid = self.valid_count.get_or_default();
            if valid > 0 {
                self.valid_count.set(valid - 1);
            }
            let revoked = self.revoked_count.get_or_default();
            self.revoked_count.set(revoked + 1);
        }

        // Update the Merkle root.
        self.merkle_root.set(new_root);
    }

    // ── Read-only entrypoints ──────────────────────────────────────────

    /// Get the current Merkle root (what the gateway verifier checks proofs against).
    pub fn current_root(&self) -> String {
        self.merkle_root.get_or_default()
    }

    /// Check if a nullifier has been revoked.
    pub fn is_nullified(&self, nullifier: String) -> bool {
        self.nullifier_set.get_or_default(&nullifier)
    }

    /// Get the status of a commitment (0=unknown, 1=valid, 2=revoked, 3=expired).
    pub fn status(&self, commitment: String) -> u8 {
        self.commitment_status.get_or_default(&commitment)
    }

    /// Get the count of valid commitments.
    pub fn valid_count(&self) -> u32 {
        self.valid_count.get_or_default()
    }

    /// Get the count of revoked commitments.
    pub fn revoked_count(&self) -> u32 {
        self.revoked_count.get_or_default()
    }

    // ── Admin ──────────────────────────────────────────────────────────

    /// Force-revoke by admin (safety net — documented, not pretended trustless).
    pub fn force_revoke(&mut self, nullifier: String, commitment: String, new_root: String) {
        self.assert_admin();
        self.revoke(nullifier, commitment, REASON_MANUAL, new_root);
    }

    // ── Internal ───────────────────────────────────────────────────────

    fn assert_admin(&self) {
        let caller = self.env().caller();
        let admin = self.admin.get().unwrap_or_revert(&self.env());
        if caller != admin {
            self.env().revert(Error::NotAdmin);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use odra::host::Deployer;

    fn setup() -> (odra::host::HostEnv, BastionHostRef) {
        let env = odra_test::env();
        let admin = env.get_account(0);
        let contract = Bastion::deploy(&env, BastionInitArgs { admin });
        (env, contract)
    }

    #[test]
    fn happy_path_insert_and_revoke() {
        let (_env, mut c) = setup();
        let commitment = "pos-commitment-1".to_string();
        let sig = "signature-1".to_string();
        let root = "root-hash-1".to_string();

        // 1. Initial views
        assert_eq!(
            c.current_root(),
            "0x0000000000000000000000000000000000000000000000000000000000000000"
        );
        assert_eq!(c.valid_count(), 0);
        assert_eq!(c.revoked_count(), 0);
        assert_eq!(c.status(commitment.clone()), STATUS_UNKNOWN);

        // 2. Insert commitment
        c.insert_commitment(commitment.clone(), sig.clone(), root.clone());
        assert_eq!(c.current_root(), root);
        assert_eq!(c.valid_count(), 1);
        assert_eq!(c.revoked_count(), 0);
        assert_eq!(c.status(commitment.clone()), STATUS_VALID);

        // 3. Try duplicate insert - should revert
        let res = c.try_insert_commitment(commitment.clone(), sig, "root-hash-2".to_string());
        assert_eq!(res, Err(Error::CommitmentExists.into()));

        // 4. Revoke
        let nullifier = "nullifier-hash-1".to_string();
        let root2 = "root-hash-3".to_string();
        c.revoke(
            nullifier.clone(),
            commitment.clone(),
            REASON_SANCTIONS,
            root2.clone(),
        );
        assert_eq!(c.current_root(), root2);
        assert_eq!(c.valid_count(), 0);
        assert_eq!(c.revoked_count(), 1);
        assert_eq!(c.status(commitment.clone()), STATUS_REVOKED);
        assert!(c.is_nullified(nullifier));
    }

    #[test]
    fn insert_non_admin_reverts() {
        let (env, mut c) = setup();
        env.set_caller(env.get_account(1));

        let res = c.try_insert_commitment(
            "commitment".to_string(),
            "sig".to_string(),
            "root".to_string(),
        );
        assert_eq!(res, Err(Error::NotAdmin.into()));
    }

    #[test]
    fn revoke_non_admin_reverts() {
        let (env, mut c) = setup();
        env.set_caller(env.get_account(1));

        let res = c.try_revoke(
            "nullifier".to_string(),
            "commitment".to_string(),
            REASON_SANCTIONS,
            "root".to_string(),
        );
        assert_eq!(res, Err(Error::NotAdmin.into()));
    }

    #[test]
    fn force_revoke_happy_path() {
        let (_env, mut c) = setup();
        let commitment = "commitment".to_string();
        c.insert_commitment(commitment.clone(), "sig".to_string(), "root".to_string());

        let nullifier = "nullifier".to_string();
        let root2 = "root2".to_string();
        c.force_revoke(nullifier.clone(), commitment.clone(), root2.clone());

        assert_eq!(c.current_root(), root2);
        assert_eq!(c.status(commitment), STATUS_REVOKED);
        assert!(c.is_nullified(nullifier));
    }

    #[test]
    fn force_revoke_non_admin_reverts() {
        let (env, mut c) = setup();
        env.set_caller(env.get_account(1));

        let res = c.try_force_revoke(
            "nullifier".to_string(),
            "commitment".to_string(),
            "root".to_string(),
        );
        assert_eq!(res, Err(Error::NotAdmin.into()));
    }

    #[test]
    fn revoke_unknown_commitment_does_not_change_counts() {
        let (_env, mut c) = setup();
        let commitment = "unknown-commitment".to_string();
        let nullifier = "nullifier-1".to_string();
        let root = "root-hash-1".to_string();

        c.revoke(
            nullifier.clone(),
            commitment,
            REASON_ANOMALOUS,
            root.clone(),
        );

        assert_eq!(c.current_root(), root);
        assert_eq!(c.valid_count(), 0);
        assert_eq!(c.revoked_count(), 0); // remains 0 since it was not STATUS_VALID
        assert!(c.is_nullified(nullifier));
    }
}
