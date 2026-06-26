import { describe, expect, it } from "vitest";
import { assertServerEnv } from "./config";

describe("assertServerEnv", () => {
  it("passes when all specified keys are present in config", () => {
    expect(() => assertServerEnv(["network"])).not.toThrow();
  });

  it("throws when a specified key is missing in config", () => {
    expect(() => assertServerEnv(["contractHash"])).toThrow("Missing required env: contractHash");
  });
});
