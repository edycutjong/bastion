// Server-only runtime config. Never import into client components.

export const config = {
  csprCloudKey: process.env.CSPR_CLOUD_API_KEY ?? "",
  network: process.env.CASPER_NETWORK ?? "casper-test",
  nodeRpc: process.env.CASPER_NODE_RPC ?? "https://node.testnet.cspr.cloud/rpc",
  chainName: process.env.CASPER_CHAIN_NAME ?? "casper-test",
  issuerKeyPath: process.env.CASPER_ISSUER_SECRET_KEY_PATH ?? "./data/keys/issuer_secret_key.pem",
  contractHash: process.env.BASTION_CONTRACT_HASH ?? "",

  x402FacilitatorUrl: process.env.X402_FACILITATOR_URL ?? "https://x402-facilitator.cspr.cloud",
  x402AssetPackage: process.env.X402_ASSET_PACKAGE ?? "",
  x402PayeeAddress: process.env.X402_PAYEE_ADDRESS ?? "",
  x402ChainId: process.env.X402_CAIP2_CHAIN_ID ?? "casper:casper-test",

  // Real Claude compliance officer over revocation events (optional — keyless
  // fallback keeps the deterministic pipeline unchanged).
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  officerModel: process.env.BASTION_OFFICER_MODEL ?? "claude-haiku-4-5",
} as const;

export function assertServerEnv(keys: (keyof typeof config)[]): void {
  const missing = keys.filter((k) => !config[k]);
  if (missing.length) {
    throw new Error(`Missing required env: ${missing.join(", ")} (see .env.example)`);
  }
}
