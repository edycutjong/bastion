// Server-only loaders for the deterministic demo fixtures (data/fixtures/).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Applicant } from "@/core/types";

const FIX = join(process.cwd(), "data", "fixtures");

export interface SecretsFixture {
  [holderId: string]: {
    secret: string;
    commitment: string;
    nullifier: string;
  };
}

export interface SanctionsFixture {
  entries: Array<{
    holderId: string;
    addedAt: string;
    reason: string;
  }>;
}

export interface ExpectedState {
  status: string;
  proofVerifies: boolean;
  inPool: boolean;
}

export interface ExpectedStatesFixture {
  afterIssuance: Record<string, ExpectedState>;
  afterRevocation: Record<string, ExpectedState>;
}

export function loadApplicants(): Applicant[] {
  return JSON.parse(readFileSync(join(FIX, "applicants.json"), "utf8"));
}

export function loadSecrets(): SecretsFixture {
  return JSON.parse(readFileSync(join(FIX, "secrets.json"), "utf8"));
}

export function loadSanctions(): SanctionsFixture {
  return JSON.parse(readFileSync(join(FIX, "sanctions.json"), "utf8"));
}

export function loadExpectedStates(): ExpectedStatesFixture {
  return JSON.parse(readFileSync(join(FIX, "expected_states.json"), "utf8"));
}
