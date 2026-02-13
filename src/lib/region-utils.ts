import type { Customer } from "./customer-types";

export const REGIONS = [
  "North Coast",
  "North Valley/Sierra",
  "Bay Area",
  "Central Coast",
  "Central Valley",
] as const;

export type Region = (typeof REGIONS)[number];

/** Map agent emails to their assigned region */
export const AGENT_REGIONS: Record<string, Region> = {
  "agent.smith@exfsafegrid.com": "Bay Area",
  "agent.rivera@exfsafegrid.com": "North Coast",
  "agent.chen@exfsafegrid.com": "Central Valley",
  "agent.williams@exfsafegrid.com": "North Valley/Sierra",
  "agent.lopez@exfsafegrid.com": "Central Coast",
};

export type PriorityLevel = 1 | 2 | 3 | 0;

/** Get priority ranking for a customer under Red Flag Warning conditions */
export function getRedFlagPriority(c: Customer): PriorityLevel {
  // P1: HFTD Tier 3 + High Grid Stress
  if (c.hftd_tier === "Tier 3" && c.grid_stress_level === "High") return 1;
  // P2: Medical Baseline in active PSPS/EPSS zones (high wildfire risk)
  if (c.medical_baseline && c.wildfire_risk === "High") return 2;
  // P3: Financial Arrears in high-risk zones
  if (c.arrears_status === "Yes" && (c.wildfire_risk === "High" || c.hftd_tier === "Tier 3")) return 3;
  return 0;
}

export function getPriorityLabel(p: PriorityLevel): string {
  switch (p) {
    case 1: return "P1 — Extreme Risk";
    case 2: return "P2 — Medical Priority";
    case 3: return "P3 — Financial Vulnerability";
    default: return "Standard";
  }
}

export function getPriorityColor(p: PriorityLevel): string {
  switch (p) {
    case 1: return "text-destructive";
    case 2: return "text-warning";
    case 3: return "text-orange-500";
    default: return "text-muted-foreground";
  }
}

/** Sort customers: Red Flag mode uses priority ranking, standard uses alphabetic */
export function sortCustomers(customers: Customer[], redFlagActive: boolean): Customer[] {
  if (!redFlagActive) {
    return [...customers].sort((a, b) => a.name.localeCompare(b.name));
  }
  return [...customers].sort((a, b) => {
    const pa = getRedFlagPriority(a);
    const pb = getRedFlagPriority(b);
    // Lower priority number = higher priority (1 > 2 > 3 > 0)
    const rankA = pa === 0 ? 99 : pa;
    const rankB = pb === 0 ? 99 : pb;
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name);
  });
}
