import { describe, it, expect } from "vitest";
import {
  loadApplicants,
  loadSecrets,
  loadSanctions,
  loadExpectedStates,
} from "./fixtures";

describe("fixtures loaders", () => {
  it("should load applicants fixture correctly", () => {
    const applicants = loadApplicants();
    expect(applicants).toBeInstanceOf(Array);
    expect(applicants.length).toBeGreaterThan(0);
    expect(applicants[0]).toHaveProperty("id");
    expect(applicants[0]).toHaveProperty("documents");
  });

  it("should load secrets fixture correctly", () => {
    const secrets = loadSecrets();
    expect(secrets).toBeTypeOf("object");
    expect(secrets).toHaveProperty("alice");
    expect(secrets.alice).toHaveProperty("secret");
  });

  it("should load sanctions fixture correctly", () => {
    const sanctions = loadSanctions();
    expect(sanctions).toBeTypeOf("object");
    expect(sanctions).toHaveProperty("entries");
    expect(sanctions.entries).toBeInstanceOf(Array);
  });

  it("should load expected states fixture correctly", () => {
    const expectedStates = loadExpectedStates();
    expect(expectedStates).toBeTypeOf("object");
    expect(expectedStates).toHaveProperty("afterIssuance");
    expect(expectedStates).toHaveProperty("afterRevocation");
  });
});
