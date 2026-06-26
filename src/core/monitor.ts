// Monitor agent — watches for risk events (seeded sanctions list) and triggers
// autonomous revocation when a holder is flagged. Uses CSPR.cloud streaming pattern.
// The autonomous revocation is the headline demo moment.

import type { RiskEvent, RiskEventType } from "./types";

// ── Risk Feed (Mock) ───────────────────────────────────────────────────────

export interface SanctionsEntry {
  holderId: string;
  /** ISO 8601 timestamp when the entry was added. */
  addedAt: string;
  reason: string;
}

export interface RiskFeed {
  entries: SanctionsEntry[];
}

/**
 * Check a holder against the sanctions feed.
 * Returns the matching entry if the holder is sanctioned, or null.
 */
export function checkSanctions(holderId: string, feed: RiskFeed): SanctionsEntry | null {
  return feed.entries.find((e) => e.holderId === holderId) ?? null;
}

/**
 * Scan all holders against the risk feed and return risk events for flagged holders.
 */
export function scanForRisks(holderIds: string[], feed: RiskFeed): RiskEvent[] {
  const events: RiskEvent[] = [];
  let eventCounter = 0;

  for (const holderId of holderIds) {
    const match = checkSanctions(holderId, feed);
    if (match) {
      eventCounter++;
      events.push({
        id: `risk-${eventCounter}`,
        holderId,
        type: "sanctions_hit" as RiskEventType,
        description: match.reason,
        detectedAt: match.addedAt,
        autonomous: true,
      });
    }
  }

  return events;
}

// ── Monitor Agent Loop ─────────────────────────────────────────────────────

export interface MonitorConfig {
  /** Holders to watch. */
  holderIds: string[];
  /** The current sanctions feed. */
  feed: RiskFeed;
  /** Callback when a risk event triggers a revocation. */
  onRevoke: (event: RiskEvent) => Promise<string | undefined>;
}

/**
 * Run a single monitoring pass — scan for risks and trigger revocations.
 * In production, this runs continuously on CSPR.cloud SSE streams.
 * For the demo, it's called once after the sanctions feed is updated.
 *
 * Returns the risk events that were detected and processed.
 */
export async function monitorPass(config: MonitorConfig): Promise<RiskEvent[]> {
  const events = scanForRisks(config.holderIds, config.feed);

  for (const event of events) {
    // Trigger autonomous revocation.
    const deployHash = await config.onRevoke(event);
    event.deployHash = deployHash;
  }

  return events;
}

/**
 * Create a monitor agent with a streaming-style interface.
 * In production: connects to CSPR.cloud SSE (`/events?account=...`) and
 * monitors for relevant contract events + cross-references a risk API.
 */
export function createMonitorAgent(config: MonitorConfig) {
  let isRunning = false;
  const processedEvents: RiskEvent[] = [];

  return {
    /** Start monitoring (single-pass for demo). */
    async start(): Promise<RiskEvent[]> {
      if (isRunning) throw new Error("Monitor is already running.");
      isRunning = true;

      try {
        const events = await monitorPass(config);
        processedEvents.push(...events);
        return events;
      } finally {
        isRunning = false;
      }
    },

    /** Get all processed events. */
    getProcessedEvents(): RiskEvent[] {
      return [...processedEvents];
    },

    /** Update the risk feed (e.g., when a new sanctions list arrives). */
    updateFeed(feed: RiskFeed): void {
      config.feed = feed;
    },

    /** Check if the monitor is currently running. */
    get running(): boolean {
      return isRunning;
    },
  };
}
