export interface Customer {
  id: string;
  name: string;
  email: string | null;
  zip_code: string;
  wildfire_risk: string;
  arrears_status: string;
  arrears_amount: number;
  bill_trend: string;
  grid_stress_level: string;
  outage_history: string | null;
  created_at: string;
}

export function buildCustomerContext(c: Customer): string {
  return `Customer context:
Name: ${c.name}
ZIP: ${c.zip_code}
Wildfire risk tier: ${c.wildfire_risk}
Bill status: ${c.arrears_status === "Yes" ? "Past Due" : "Current"}
Past-due amount: $${c.arrears_amount}
Bill trend: ${c.bill_trend}
Grid stress level: ${c.grid_stress_level}
Outage history: ${c.outage_history || "None"}`;
}
