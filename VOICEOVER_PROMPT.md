Compliance systems face a critical paradox: to verify that users are KYC-compliant, institutions force them to repeatedly surrender their personally identifiable information. This creates massive central data silos vulnerable to breaches. How do we prove set-membership and compliance on-chain without exposing a single byte of private data?

Introducing Bastion: a zero-knowledge compliance gateway for the Casper ecosystem. The on-chain registry, built in Rust using the Odra framework, stores only a Merkle root of valid commitments and a nullifier revocation set. In the Compliance Console, users prove KYC compliance off-chain using a Groth16-shaped set-membership proof. Let's inspect the active pool.

Let's click on Alice's credential card and expand the ZK Proof Trace. The console reveals the exact cryptographic calculations: the Poseidon commitment leaf hash, the derived nullifier hash, and the target Merkle root. We verify the proof locally, confirming that Alice is a valid member of the pool, while her real identity remains completely hidden.

Now, let's trigger a risk simulation. We click 'Trigger OFAC hit on Mallory'. Instantly, the screen flashes red and shakes as the autonomous monitoring agent detects the sanctions hit. The monitor broadcasts a transaction to the Casper Testnet, publishing Mallory's nullifier and updating the Merkle root. Mallory's card turns red, and she is instantly ejected from the pool.

With the root updated, all remaining valid members—like Alice and Bob—re-prove themselves against the new state. A protocol trying to check compliance queries our gateway. The query triggers a Casper x402 challenge. The consumer settles the micropayment via the facilitator, and the gateway returns a simple boolean response: compliant, true. No identity is ever disclosed.

Bastion proves that compliance does not require surveillance. By combining local zero-knowledge proof generation, reactive streaming monitors, and on-chain registries on Casper, we deliver institutional-grade KYC that respects individual privacy. Bastion is live on Casper Testnet. Visit our repository and build secure gateways today.
