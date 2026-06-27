//! Livenet deploy script for the Bastion credential-registry contract.
//!
//! Deploys to Casper Testnet via the Odra livenet backend. Run:
//!   cargo run --bin bastion_livenet --features livenet
//!
//! Required env (see ../LIVE_TESTNET.md):
//!   ODRA_CASPER_LIVENET_SECRET_KEY_PATH  — PEM of a faucet-funded Testnet key
//!   ODRA_CASPER_LIVENET_NODE_ADDRESS     — e.g. https://node.testnet.cspr.cloud
//!   ODRA_CASPER_LIVENET_CHAIN_NAME       — casper-test
//!   ODRA_CASPER_LIVENET_EVENTS_URL       — e.g. https://node.testnet.cspr.cloud/events
//! Optional:
//!   BASTION_INSTALL_GAS   — install gas in motes (default 300 CSPR)

use bastion::bastion::{Bastion, BastionInitArgs};
use odra::host::Deployer;
use odra::prelude::Addressable;

fn main() {
    let env = odra_casper_livenet_env::env();

    let install_gas: u64 = std::env::var("BASTION_INSTALL_GAS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(300_000_000_000u64);

    // The deployer becomes `admin` (the issuer/monitor key).
    let admin = env.caller();

    env.set_gas(install_gas);
    let contract = Bastion::deploy(&env, BastionInitArgs { admin });

    println!("✅ Bastion deployed to Casper Testnet");
    println!("   contract address : {:?}", contract.address());
    println!("   admin            : {:?}", admin);
    println!();
    println!("Set BASTION_CONTRACT_HASH in .env.local to the hash above (strip any prefix).");
}
