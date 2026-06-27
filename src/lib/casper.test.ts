import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock node:fs readFileSync
vi.mock("node:fs", () => ({
  readFileSync: vi.fn().mockReturnValue("mock-pem-data"),
}));

vi.mock("casper-js-sdk", () => {
  class MockHttpHandler {
    setCustomHeaders = vi.fn();
  }

  class MockContractCallBuilder {
    from = vi.fn().mockReturnThis();
    byHash = vi.fn().mockReturnThis();
    byPackageHash = vi.fn().mockReturnThis();
    entryPoint = vi.fn().mockReturnThis();
    runtimeArgs = vi.fn().mockReturnThis();
    chainName = vi.fn().mockReturnThis();
    payment = vi.fn().mockReturnThis();
    build = vi.fn().mockReturnValue({
      sign: vi.fn(),
    });
  }

  class MockRpcClient {
    putTransaction = vi.fn().mockResolvedValue({
      transactionHash: {
        toHex: () => "deploy-hash-hex",
      },
    });
  }

  return {
    KeyAlgorithm: {
      ED25519: "ed25519",
      SECP256K1: "secp256k1",
    },
    PrivateKey: {
      fromPem: vi.fn().mockReturnValue({
        publicKey: {
          toHex: () => "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f2021",
        },
      }),
    },
    CLValue: {
      newCLString: vi.fn().mockImplementation((val) => ({ type: "string", val })),
      newCLUint8: vi.fn().mockImplementation((val) => ({ type: "uint8", val })),
    },
    ContractCallBuilder: MockContractCallBuilder,
    HttpHandler: MockHttpHandler,
    RpcClient: MockRpcClient,
    Args: {
      fromMap: vi.fn().mockImplementation((map) => map),
    },
  };
});

import {
  txExplorerUrl,
  insertCommitmentOnChain,
  revokeOnChain,
} from "./casper";
import { config } from "./config";

describe("casper chain layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates transaction explorer URL", () => {
    expect(txExplorerUrl("hash123")).toBe("https://testnet.cspr.live/transaction/hash123");
  });

  it("throws in insertCommitmentOnChain if contractHash is not set", async () => {
    const originalHash = config.contractHash;
    (config as any).contractHash = "";

    try {
      await expect(
        insertCommitmentOnChain({
          commitment: "0x123",
          attestationSig: "0x456",
          newRoot: "0x789",
        })
      ).rejects.toThrow("BASTION_CONTRACT_HASH not set");
    } finally {
      (config as any).contractHash = originalHash;
    }
  });

  it("inserts commitment on chain successfully (with different key algorithms)", async () => {
    const originalHash = config.contractHash;
    const originalAlgo = process.env.CASPER_KEY_ALGO;
    (config as any).contractHash = "hash-contract";

    try {
      // ED25519
      process.env.CASPER_KEY_ALGO = "ed25519";
      let result = await insertCommitmentOnChain({
        commitment: "0x123",
        attestationSig: "0x456",
        newRoot: "0x789",
      });
      expect(result.deployHash).toBe("deploy-hash-hex");

      // SECP256K1
      process.env.CASPER_KEY_ALGO = "secp256k1";
      result = await insertCommitmentOnChain({
        commitment: "0x123",
        attestationSig: "0x456",
        newRoot: "0x789",
      });
      expect(result.deployHash).toBe("deploy-hash-hex");

      // undefined
      delete process.env.CASPER_KEY_ALGO;
      result = await insertCommitmentOnChain({
        commitment: "0x123",
        attestationSig: "0x456",
        newRoot: "0x789",
      });
      expect(result.deployHash).toBe("deploy-hash-hex");
    } finally {
      (config as any).contractHash = originalHash;
      process.env.CASPER_KEY_ALGO = originalAlgo;
    }
  });

  it("uses csprCloudKey if set", async () => {
    const originalHash = config.contractHash;
    const originalKey = config.csprCloudKey;
    (config as any).contractHash = "hash-contract";
    (config as any).csprCloudKey = "test-api-key";

    try {
      const result = await insertCommitmentOnChain({
        commitment: "0x123",
        attestationSig: "0x456",
        newRoot: "0x789",
      });
      expect(result.deployHash).toBe("deploy-hash-hex");
    } finally {
      (config as any).contractHash = originalHash;
      (config as any).csprCloudKey = originalKey;
    }
  });

  it("loads key directly from string if PEM block is provided in config", async () => {
    const originalHash = config.contractHash;
    const originalPath = config.issuerKeyPath;
    (config as any).contractHash = "hash-contract";
    (config as any).issuerKeyPath = "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----";

    try {
      const result = await insertCommitmentOnChain({
        commitment: "0x123",
        attestationSig: "0x456",
        newRoot: "0x789",
      });
      expect(result.deployHash).toBe("deploy-hash-hex");
    } finally {
      (config as any).contractHash = originalHash;
      (config as any).issuerKeyPath = originalPath;
    }
  });

  it("revokes on chain successfully", async () => {
    const originalHash = config.contractHash;
    (config as any).contractHash = "hash-contract";

    try {
      const result = await revokeOnChain({
        nullifier: "0x111",
        commitment: "0x222",
        reasonCode: 1,
        newRoot: "0x333",
      });
      expect(result.deployHash).toBe("deploy-hash-hex");
    } finally {
      (config as any).contractHash = originalHash;
    }
  });
});
