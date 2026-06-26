// EIP-712 typed-data credential issuance.
// Issues gasless compliance credentials — no PII ever on-chain.
// Mock signing for the demo; pluggable to real ethers/viem EIP-712 signing.
// ⚠️ casper-eip-712 provides `hashTypedData` + `recoverTypedDataSigner` but does NOT
//    contain a `signTypedData` function. Use ethers (`wallet.signTypedData`) or viem
//    for the actual 65-byte secp256k1 signature. Pattern proven in
//    casper-eip-712/examples/viem-signing/demo.ts.

import { createHash, randomBytes } from "node:crypto";
import type { Eip712Credential, PoseidonHash } from "./types";

// ── EIP-712 Domain & Type Definitions ──────────────────────────────────────

export const EIP712_DOMAIN = {
  name: "Bastion",
  version: "1",
  chainId: "casper-test",
  verifyingContract: "bastion-credential-registry",
} as const;

export const EIP712_TYPES = {
  ComplianceCredential: [
    { name: "holder", type: "string" },
    { name: "attributesHash", type: "bytes32" },
    { name: "issuedAt", type: "string" },
    { name: "expiresAt", type: "string" },
  ],
} as const;

// ── Credential Issuance ────────────────────────────────────────────────────

export interface IssueCredentialInput {
  /** The holder's public key or account hash. */
  holder: string;
  /** Hash of the verified attributes (from the verifier agent). */
  attributesHash: PoseidonHash;
  /** Issuer public key. */
  issuer: string;
  /** Credential validity period in seconds (default: 30 days). */
  validitySeconds?: number;
}

/**
 * Issue a gasless EIP-712 compliance credential.
 * No wallet popup, no gas — the issuer signs a typed-data structure off-chain.
 * In production, uses ethers `wallet.signTypedData()` + casper-eip-712 `recoverTypedDataSigner()` for verification.
 */
export function issueCredential(input: IssueCredentialInput): Eip712Credential {
  const now = new Date();
  const expiry = new Date(now.getTime() + (input.validitySeconds ?? 30 * 24 * 60 * 60) * 1000);

  const credential: Omit<Eip712Credential, "signature"> = {
    holder: input.holder,
    attributesHash: input.attributesHash,
    issuedAt: now.toISOString(),
    expiresAt: expiry.toISOString(),
    issuer: input.issuer,
  };

  // Production EIP-712 signing (casper-eip-712 does NOT have signTypedData):
  //   import { ethers } from 'ethers';
  //   const wallet = new ethers.Wallet(issuerPrivateKey);
  //   const signature = await wallet.signTypedData(
  //     EIP712_DOMAIN, EIP712_TYPES, { holder, attributesHash, issuedAt, expiresAt }
  //   );
  //   Verify with: import { recoverTypedDataSigner } from 'casper-eip-712';
  const signature = signTypedDataMock(credential);

  return { ...credential, signature };
}

/**
 * Verify an EIP-712 credential signature.
 * Returns true if the signature matches the expected hash of the credential data.
 */
export function verifyCredential(credential: Eip712Credential): boolean {
  const expectedSig = signTypedDataMock({
    holder: credential.holder,
    attributesHash: credential.attributesHash,
    issuedAt: credential.issuedAt,
    expiresAt: credential.expiresAt,
    issuer: credential.issuer,
  });
  return credential.signature === expectedSig;
}

/**
 * Check if a credential has expired.
 */
export function isExpired(credential: Eip712Credential): boolean {
  return new Date(credential.expiresAt) < new Date();
}

// ── Mock EIP-712 Signing ───────────────────────────────────────────────────

/** Generate a deterministic issuer key pair for the demo. */
export function generateIssuerKeypair(): { publicKey: string; secretKey: string } {
  const secretKey = randomBytes(32).toString("hex");
  const publicKey = createHash("sha256").update(secretKey).digest("hex").slice(0, 64);
  return { publicKey: `0x${publicKey}`, secretKey };
}

function signTypedDataMock(data: Omit<Eip712Credential, "signature">): string {
  const payload = JSON.stringify({
    domain: EIP712_DOMAIN,
    types: EIP712_TYPES,
    message: {
      holder: data.holder,
      attributesHash: data.attributesHash,
      issuedAt: data.issuedAt,
      expiresAt: data.expiresAt,
    },
  });
  return `0x${createHash("sha256").update(payload).digest("hex")}`;
}
