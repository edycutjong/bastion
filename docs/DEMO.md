# Bastion — Demo Script (≤ 3 min)

## Cold open (0:00–0:20)
VO: *"To let real-world assets into DeFi, you need KYC. The usual way means putting passports on a public ledger. Bastion proves compliance in zero-knowledge — without ever showing who you are — and pulls it back the second you stop being compliant."*

## Act 1 — Issue + prove in zero-knowledge (0:20–1:10)
- **alice** submits documents (off-chain). The Verifier agent approves.
- An **EIP-712-style credential** is signed — *no wallet popup, no gas*. The attestation is a **SHA-256 stand-in** for EIP-712 typed-data in the demo (`src/core/attest.ts`), and her commitment is inserted into the on-chain Merkle set. In live mode (`BASTION_DEMO=false`) the insert is broadcast via **casper-js-sdk** (backend PEM key) for a real Testnet deploy hash; in demo mode a clearly-labelled placeholder hash is returned.
- alice clicks **Enter pool** → a **Groth16-shaped ZK proof** is generated (simulated — SHA-256 stand-in with the snarkjs `pi_a/pi_b/pi_c` shape; her secret never leaves the server) and verifies against the on-chain root → admitted. VO: *"She just proved she's compliant — and the pool learned nothing about who she is."*
- Click **scan on-chain state** → "**0 PII fields found — just a Merkle root**." Quick cut: **carol** fails verification → can't produce a valid proof → never admitted.

## Act 2 — Pay-to-check via x402 (1:10–1:45)
- A mock RWA dApp submits alice's proof to `/check` → **402** → **EIP-712-style CEP-18 payment**. In demo mode the payment/settlement is mocked; with `BASTION_DEMO=false` + full x402 env the real facilitator (`src/core/x402_facilitator.ts`, over the CSPR.cloud facilitator endpoint) verifies and settles → **200 `true`**.
- Show the settlement hash (placeholder in demo, real deploy hash when live). VO: *"Any protocol can verify compliance per call — and only ever gets a yes or no."*

## Act 3 — The auto-revocation (1:45–2:40) — the headline
- **mallory** is valid and inside the pool (entered with her own simulated ZK proof).
- Trigger the seeded risk event from the simulated risk feed (`src/core/monitor.ts`, self-labelled "Risk Feed (Mock)"): mallory hits the sanctions list.
- The **Monitor agent autonomously revokes** — root/nullifier updated → **mallory's proof now fails to verify** → the gated pool **ejects her** on screen. In live mode the `revoke` is a real Testnet transaction via **casper-js-sdk**; in demo mode a placeholder deploy hash is shown.
- VO: *"No human clicked anything. Her proof of compliance just stopped being true — and the chain enforced it in seconds."*

## Act 4 — Close (2:40–3:00)
- Recap the three guarantees: PII-free, revocable, autonomous.
- *"Bastion — compliance without surveillance, part of Vouch on Casper. Thank you for reviewing."*

## Expected outputs
| Step | Expected |
|---|---|
| alice issue | commitment inserted, deploy hash (real via casper-js-sdk when live, placeholder in demo), 0 PII on-chain |
| alice entry | Groth16-shaped (simulated) proof verifies vs on-chain root → admitted (no identity revealed) |
| carol | declined, no commitment → no valid proof |
| x402 check | 402 → EIP-712-style pay → 200 `true`, settlement hash (mock in demo; real facilitator settle when `BASTION_DEMO=false`) |
| mallory risk | auto-revoke (real tx via casper-js-sdk when live, placeholder in demo); her proof now **fails** to verify; ejected from pool |
| scan_pii | 0 PII fields found (only a Merkle root + nullifiers) |
