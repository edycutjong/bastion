// Real Casper Testnet chain layer (casper-js-sdk v5 / Condor).
// Server-only. Demo never imports this; reached only when BASTION_DEMO === "false"
// and the contract + issuer key are configured.
//
// API verified against casper-js-sdk@5.0.12 .d.ts:
//   PrivateKey.fromPem(pem, KeyAlgorithm) · new RpcClient(new HttpHandler(url, "fetch"))
//   HttpHandler.setCustomHeaders({ Authorization }) · ContractCallBuilder(...).build()
//   tx.sign(key) · client.putTransaction(tx) → res.transactionHash.toHex()

import { readFileSync } from "node:fs";
import {
  Args,
  CLValue,
  ContractCallBuilder,
  HttpHandler,
  KeyAlgorithm,
  PrivateKey,
  RpcClient,
} from "casper-js-sdk";
import { config } from "./config";

const DEFAULT_PAYMENT_MOTES = Number(process.env.CASPER_CALL_PAYMENT_MOTES ?? 5_000_000_000);

function keyAlgorithm(): KeyAlgorithm {
  return (process.env.CASPER_KEY_ALGO ?? "ed25519").toLowerCase() === "secp256k1"
    ? KeyAlgorithm.SECP256K1
    : KeyAlgorithm.ED25519;
}

function loadSignerKey(): PrivateKey {
  let pem: string;
  if (config.issuerKeyPath.includes("-----BEGIN")) {
    pem = config.issuerKeyPath.replace(/\\n/g, "\n");
  } else {
    pem = readFileSync(config.issuerKeyPath, "utf8");
  }
  return PrivateKey.fromPem(pem, keyAlgorithm());
}

function makeRpcClient(): RpcClient {
  const handler = new HttpHandler(config.nodeRpc, "fetch");
  if (config.csprCloudKey) handler.setCustomHeaders({ Authorization: config.csprCloudKey });
  return new RpcClient(handler);
}

function bareHash(hash: string): string {
  return hash.replace(/^(hash-|contract-|entity-contract-)/, "");
}

export function txExplorerUrl(hash: string): string {
  return `https://testnet.cspr.live/transaction/${hash}`;
}

export interface ContractCallResult {
  deployHash: string;
  explorerUrl: string;
}

async function callContract(entryPoint: string, args: Args, paymentMotes = DEFAULT_PAYMENT_MOTES): Promise<ContractCallResult> {
  if (!config.contractHash) {
    throw new Error("BASTION_CONTRACT_HASH not set — deploy the Merkle/nullifier contract first (see LIVE_TESTNET.md).");
  }
  const key = loadSignerKey();
  // Odra deploys a contract PACKAGE; calls must target the package (latest version),
  // not an addressable-entity hash — byHash(package) is rejected as an invalid transaction.
  const tx = new ContractCallBuilder()
    .from(key.publicKey)
    .byPackageHash(bareHash(config.contractHash))
    .entryPoint(entryPoint)
    .runtimeArgs(args)
    .chainName(config.chainName)
    .payment(paymentMotes)
    .build();
  tx.sign(key);
  const res = await makeRpcClient().putTransaction(tx);
  const deployHash = res.transactionHash.toHex();
  return { deployHash, explorerUrl: txExplorerUrl(deployHash) };
}

// Arg names/types verified against contract/src/bastion.rs:
//   insert_commitment(commitment: String, attestation_sig: String, new_root: String)
//   revoke(nullifier: String, commitment: String, reason_code: u8, new_root: String)

/** Broadcast a real insert_commitment(commitment, attestation_sig, new_root). */
export async function insertCommitmentOnChain(input: {
  commitment: string;
  attestationSig: string;
  newRoot: string;
}): Promise<ContractCallResult> {
  return callContract(
    "insert_commitment",
    Args.fromMap({
      commitment: CLValue.newCLString(input.commitment),
      attestation_sig: CLValue.newCLString(input.attestationSig),
      new_root: CLValue.newCLString(input.newRoot),
    }),
  );
}

/** Broadcast a real revoke(nullifier, commitment, reason_code, new_root). */
export async function revokeOnChain(input: {
  nullifier: string;
  commitment: string;
  reasonCode: number;
  newRoot: string;
}): Promise<ContractCallResult> {
  return callContract(
    "revoke",
    Args.fromMap({
      nullifier: CLValue.newCLString(input.nullifier),
      commitment: CLValue.newCLString(input.commitment),
      reason_code: CLValue.newCLUint8(input.reasonCode),
      new_root: CLValue.newCLString(input.newRoot),
    }),
  );
}
