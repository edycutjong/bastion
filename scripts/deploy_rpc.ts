// RPC-based contract installer — deploys the Bastion Odra wasm to Casper Testnet WITHOUT
// Odra's livenet backend (which needs a node SSE /events stream CSPR.cloud does not expose).
// Build + sign + submit via casper-js-sdk; poll the result and read the installed package
// hash from execution effects via raw JSON-RPC (the CSPR.cloud node RPC works fine).
//
// Replicates Odra's install ABI (odra-core host.rs try_deploy_with_cfg):
//   odra_cfg_is_upgradable=false, odra_cfg_is_upgrade=false, odra_cfg_allow_key_override=true,
//   odra_cfg_package_hash_key_name="Bastion_package_hash", + init arg (admin:Key).
//
// Run:  export $(grep -v '^#' .env.local | xargs) && pnpm deploy:rpc

import { readFileSync } from "node:fs";
import {
  Args,
  CLValue,
  HttpHandler,
  Key,
  KeyAlgorithm,
  KeyTypeID,
  PrivateKey,
  PublicKey,
  RpcClient,
  SessionBuilder,
} from "casper-js-sdk";
import { config } from "../src/lib/config";

const WASM_PATH = process.env.BASTION_WASM_PATH ?? "contract/wasm/Bastion.wasm";
const PACKAGE_KEY_NAME = "Bastion_package_hash";
const PAYMENT_MOTES = Number(process.env.BASTION_INSTALL_MOTES ?? 500_000_000_000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function keyAlgorithm(): KeyAlgorithm {
  return (process.env.CASPER_KEY_ALGO ?? "ed25519").toLowerCase() === "secp256k1"
    ? KeyAlgorithm.SECP256K1
    : KeyAlgorithm.ED25519;
}
function loadSignerKey(): PrivateKey {
  return PrivateKey.fromPem(readFileSync(config.issuerKeyPath, "utf8"), keyAlgorithm());
}
function makeRpcClient(): RpcClient {
  const handler = new HttpHandler(config.nodeRpc, "fetch");
  if (config.csprCloudKey) handler.setCustomHeaders({ Authorization: config.csprCloudKey });
  return new RpcClient(handler);
}
const txExplorerUrl = (h: string) => `https://testnet.cspr.live/transaction/${h}`;

async function rpc(method: string, params: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(config.nodeRpc, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: config.csprCloudKey },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: Record<string, unknown>; error?: unknown };
  if (json.error) throw new Error(`RPC ${method} → ${JSON.stringify(json.error)}`);
  return json.result ?? {};
}

async function main() {
  const key = loadSignerKey();
  const pubHex = key.publicKey.toHex();
  const wasm = new Uint8Array(readFileSync(WASM_PATH));
  console.log(`Deployer : ${pubHex}`);
  console.log(`Wasm     : ${WASM_PATH} (${wasm.length} bytes)`);
  console.log(`Gas limit: ${PAYMENT_MOTES / 1e9} CSPR\n`);

  const admin = Key.createByType(
    PublicKey.fromHex(pubHex).accountHash().toPrefixedString(),
    KeyTypeID.Account,
  );
  const args = Args.fromMap({
    odra_cfg_is_upgradable: CLValue.newCLValueBool(false),
    odra_cfg_is_upgrade: CLValue.newCLValueBool(false),
    odra_cfg_allow_key_override: CLValue.newCLValueBool(true),
    odra_cfg_package_hash_key_name: CLValue.newCLString(PACKAGE_KEY_NAME),
    admin: CLValue.newCLKey(admin),
  });

  const tx = new SessionBuilder()
    .from(key.publicKey)
    .wasm(wasm)
    .installOrUpgrade()
    .runtimeArgs(args)
    .chainName(config.chainName)
    .payment(PAYMENT_MOTES)
    .build();
  tx.sign(key);

  const res = await makeRpcClient().putTransaction(tx);
  const hash = res.transactionHash.toHex();
  console.log(`⛓  submitted install tx: ${hash}`);
  console.log(`   ${txExplorerUrl(hash)}\n   waiting for execution`);

  let execResult: Record<string, unknown> | undefined;
  for (let i = 0; i < 72; i++) {
    await sleep(5000);
    try {
      const r = await rpc("info_get_transaction", { transaction_hash: { Version1: hash } });
      const info = r.execution_info as { execution_result?: Record<string, unknown> } | null;
      if (info?.execution_result) {
        execResult = info.execution_result;
        break;
      }
    } catch {
      /* transient */
    }
    process.stdout.write(".");
  }
  process.stdout.write("\n");
  if (!execResult) throw new Error("Timed out waiting for execution (~6 min).");

  const v2 = (execResult.Version2 ?? execResult) as {
    error_message?: string | null;
    consumed?: unknown;
    effects?: Array<{ key?: string; kind?: unknown }>;
  };
  if (v2.error_message) throw new Error(`Install FAILED on-chain: ${v2.error_message} (tx ${hash})`);
  console.log(`✅ install executed on-chain. consumed=${v2.consumed ?? "?"}\n`);

  const writesPackage = (kind: unknown): boolean => {
    if (typeof kind !== "object" || kind === null) return false;
    const w = (kind as { Write?: unknown }).Write;
    if (typeof w === "string") return w === "ContractPackage";
    return typeof w === "object" && w !== null && "ContractPackage" in (w as object);
  };
  const packageHash = (v2.effects ?? []).find((t) => t.key?.startsWith("hash-") && writesPackage(t.kind))?.key;

  console.log("──────────────────────────────────────────────");
  console.log(`✅ Bastion deployed to Casper Testnet`);
  console.log(`   install tx : ${txExplorerUrl(hash)}`);
  if (packageHash) {
    console.log(`   package    : ${packageHash}`);
    console.log(`\n   → set in .env.local:  BASTION_CONTRACT_HASH=${packageHash}`);
  } else {
    console.log(`   ⚠️  Install succeeded but no ContractPackage write found — inspect ${txExplorerUrl(hash)}`);
  }
  console.log("──────────────────────────────────────────────");
}

main().catch((e) => {
  console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
