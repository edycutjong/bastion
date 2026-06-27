# Bastion Smart Contract 🛡️

This directory contains the **Bastion Upgradable Credential Registry** smart contract, built using the [Odra framework](https://github.com/odradev/cargo-odra) in Rust for the Casper Network.

The contract acts as the on-chain anchor for the ZK compliance gateway. It holds **only the cryptographic Merkle root** of valid credential commitments and a **nullifier/revocation set**. No user profiles, wallet-to-identity links, or personally identifiable information (PII) are ever written to the blockchain.

---

## 🏗️ State Storage

The contract maintains the following state variables:
*   `admin`: The authorized issuer/monitoring agent address allowed to insert valid commitments and publish revocations.
*   `merkle_root`: The current Merkle root representing the valid commitments tree (which gateway verifiers read to verify compliance).
*   `commitment_status`: A mapping of commitment hashes (Poseidon commitment hex strings) to status codes:
    *   `0`: Unknown
    *   `1`: Valid
    *   `2`: Revoked
    *   `3`: Expired
*   `nullifier_set`: A mapping of published nullifier hashes to `true` (indicating the user's ZK proof is permanently invalidated).
*   `valid_count`: Total number of active valid credentials.
*   `revoked_count`: Total number of revoked credentials.

---

## ⛓️ Core Entrypoints

### Admin Actions
*   `init(admin: Address)`: Initializes the contract and sets the admin address.
*   `insert_commitment(commitment: String, attestation_sig: String, new_root: String)`: Inserts a new valid commitment and updates the Merkle root. Reverts if the commitment already exists.
*   `revoke(nullifier: String, commitment: String, reason_code: u8, new_root: String)`: Publishes a credential's nullifier to revoke it and updates the Merkle root.
*   `force_revoke(nullifier: String, commitment: String, new_root: String)`: Force-revokes a credential, using `REASON_MANUAL` (3) as the default reason code.

### Read-Only Queries
*   `current_root() -> String`: Returns the active Merkle root.
*   `is_nullified(nullifier: String) -> bool`: Returns true if the nullifier has been published (revoked).
*   `status(commitment: String) -> u8`: Returns the status code of a commitment.
*   `valid_count() -> u32`: Returns the count of valid credentials.
*   `revoked_count() -> u32`: Returns the count of revoked credentials.

---

## 🛠️ Usage & Commands

We recommend installing `cargo-odra` globally:
```bash
cargo install cargo-odra --locked
```

### Build Contract
Compile the contract locally:
```bash
cargo odra build
```

Compile into WebAssembly (`wasm/Bastion.wasm`) targeting the Casper VM:
```bash
cargo odra build -b casper
```

### Test Contract
Run the Rust unit tests locally:
```bash
cargo odra test
```

Run tests against the simulated Casper VM target:
```bash
cargo odra test -b casper
```

---

## ⛓️ Live Testnet Deployment

The smart contract is compiled to WASM and deployed on the **Casper Testnet** (`casper-test`).

| Asset / Role | Hash / Address |
| :--- | :--- |
| **Bastion Contract** | [`hash-d247c7118d240bb339612f176f23816aa7a42e3bce88b132cad9982707c4a2c0`](https://testnet.cspr.live/contract-package/d247c7118d240bb339612f176f23816aa7a42e3bce88b132cad9982707c4a2c0) |
| **CEP-18 Token (x402)** | [`hash-541069ed8cad06249f76edb0972932d012badbb256111d3000df06ac1d703be6`](https://testnet.cspr.live/contract-package/hash-541069ed8cad06249f76edb0972932d012badbb256111d3000df06ac1d703be6) |
| **Issuer / Admin Account** | [`01b9c7741b3679191aa4f82e5529e3f0908e3d5cbc9c3c352807e17b7c48bffc55`](https://testnet.cspr.live/account/01b9c7741b3679191aa4f82e5529e3f0908e3d5cbc9c3c352807e17b7c48bffc55) |

### 🚀 Deploying to Testnet

To deploy a new instance of the contract to Casper Testnet:
1. Configure your keys and environment variables as documented in the root [LIVE_TESTNET.md](../LIVE_TESTNET.md).
2. Run the deployment binary using the `livenet` feature flag:
   ```bash
   export ODRA_CASPER_LIVENET_SECRET_KEY_PATH=./keys/secret_key.pem
   export ODRA_CASPER_LIVENET_NODE_ADDRESS=https://node.testnet.cspr.cloud
   export ODRA_CASPER_LIVENET_CHAIN_NAME=casper-test
   export ODRA_CASPER_LIVENET_EVENTS_URL=https://node.testnet.cspr.cloud/events
   
   cargo run --bin bastion_livenet --features livenet
   ```

