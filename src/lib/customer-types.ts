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
  return `CURRENT CUSTOMER CONTEXT (always use this info in your responses):
- Name: ${c.name}
- ZIP Code: ${c.zip_code}
- Wildfire Risk: ${c.wildfire_risk}
- Arrears Status: ${c.arrears_status}
- Arrears Amount: $${c.arrears_amount}
- Bill Trend: ${c.bill_trend}
- Grid Stress Level: ${c.grid_stress_level}
- Recent Outages: ${c.outage_history || "None"}`;
}
