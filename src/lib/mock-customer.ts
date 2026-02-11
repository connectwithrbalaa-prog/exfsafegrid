export interface CustomerProfile {
  name: string;
  zip_code: string;
  wildfire_risk: "Low" | "Medium" | "High";
  arrears_status: "Current" | "Past Due" | "Critical";
  bill_trend: "Stable" | "Increasing" | "Decreasing";
  grid_stress_level: "Normal" | "Elevated" | "High";
  monthly_bill: number;
  past_due_amount: number;
}

export const mockCustomer: CustomerProfile = {
  name: "Maria Santos",
  zip_code: "95603",
  wildfire_risk: "High",
  arrears_status: "Past Due",
  bill_trend: "Increasing",
  grid_stress_level: "Elevated",
  monthly_bill: 187,
  past_due_amount: 342,
};

export function buildCustomerContext(c: CustomerProfile): string {
  return `Customer context:
Name: ${c.name}
ZIP: ${c.zip_code}
Wildfire risk tier: ${c.wildfire_risk}
Bill status: ${c.arrears_status}
Current monthly bill: $${c.monthly_bill}
Past-due amount: $${c.past_due_amount}
Bill trend: ${c.bill_trend}
Grid stress level: ${c.grid_stress_level}`;
}
