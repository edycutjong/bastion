# Bastion — Demo Script (≤ 3 min)

## Cold open (0:00–0:20)
VO: *"To let real-world assets into DeFi, you need KYC. The usual way means putting passports on a public ledger. Bastion proves compliance in zero-knowledge — without ever showing who you are — and pulls it back the second you stop being compliant."*

## Act 1 — Issue + prove in zero-knowledge (0:20–1:10)
- **alice** submits documents (off-chain). The Verifier agent approves.
- A **casper-eip-712** credential is signed — *no wallet popup, no gas* — and her **Poseidon commitment** is inserted into the on-chain Merkle set via **CSPR.click**. Real Testnet deploy hash.
- alice clicks **Enter pool** → a **Groth16 ZK proof** generates in-browser (her secret never leaves the device) and verifies against the on-chain root → admitted. VO: *"She just proved she's compliant — and the pool learned nothing about who she is."*
- Click **scan on-chain state** → "**0 PII fields found — just a Merkle root**." Quick cut: **carol** fails verification → can't produce a valid proof → never admitted.

## Act 2 — Pay-to-check via x402 (1:10–1:45)
- A mock RWA dApp submits alice's proof to `/check` → **402** → eip-712 CEP-18 payment → CSPR.cloud facilitator settles → **200 `true`**.
- Show the settlement deploy hash. VO: *"Any protocol can verify compliance per call — and only ever gets a yes or no."*

## Act 3 — The auto-revocation (1:45–2:40) — the headline
- **mallory** is valid and inside the pool (entered with her own ZK proof).
- Trigger the seeded risk event: mallory hits the sanctions list.
- The **Monitor agent autonomously revokes** — real **revocation deploy hash** → root/nullifier updated → **mallory's ZK proof now fails to verify** → the gated pool **ejects her** on screen.
- VO: *"No human clicked anything. Her proof of compliance just stopped being true — and the chain enforced it in seconds."*

## Act 4 — Close (2:40–3:00)
- Recap the three guarantees: PII-free, revocable, autonomous.
- *"Bastion — compliance without surveillance, part of Vouch on Casper. Thank you for reviewing."*

## Expected outputs
| Step | Expected |
|---|---|
| alice issue | commitment inserted, real deploy hash, 0 PII on-chain |
| alice entry | Groth16 proof verifies vs on-chain root → admitted (no identity revealed) |
| carol | declined, no commitment → no valid proof |
| x402 check | 402 → pay → 200 `true`, settlement hash |
| mallory risk | auto-revoke tx; her proof now **fails** to verify; ejected from pool |
| scan_pii | 0 PII fields found (only a Merkle root + nullifiers) |
