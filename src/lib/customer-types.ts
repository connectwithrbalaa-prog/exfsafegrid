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
  agent_notes: string | null;
  region: string;
  hftd_tier: string;
  medical_baseline: boolean;
  has_portable_battery: boolean;
  has_transfer_meter: boolean;
  has_permanent_battery: string;
  current_outage_status: string;
  restoration_timer: string;
  nearest_crc_location: string;
  created_at: string;
  psps_phase: string;
  patrolling_progress: number;
  doorbell_status: string;
  digital_ack_status: string;
  last_update: string;
  psps_event_id: string;
}

export function buildCustomerContext(c: Customer): string {
  return `CURRENT CUSTOMER CONTEXT (always use this info in your responses):
- Name: ${c.name}
- ZIP Code: ${c.zip_code}
- Region: ${c.region}
- HFTD Tier: ${c.hftd_tier}
- Medical Baseline: ${c.medical_baseline ? "Yes — Enrolled" : "No"}
- Wildfire Risk: ${c.wildfire_risk}
- Arrears Status: ${c.arrears_status}
- Arrears Amount: $${c.arrears_amount}
- Bill Trend: ${c.bill_trend}
- Grid Stress Level: ${c.grid_stress_level}
- Recent Outages: ${c.outage_history || "None"}
- Portable Battery: ${c.has_portable_battery ? "Yes" : "No"}
- Transfer Meter: ${c.has_transfer_meter ? "Yes" : "No"}
- Permanent Battery: ${c.has_permanent_battery}
- Outage Status: ${c.current_outage_status}
- Restoration Timer: ${c.restoration_timer}
- Nearest CRC: ${c.nearest_crc_location || "None"}`;
}
