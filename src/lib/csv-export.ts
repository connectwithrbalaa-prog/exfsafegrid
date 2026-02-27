// src/lib/csv-export.ts — CSV download helpers for risk export buttons

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatCircuitRiskCsv(results: any[]): string {
  const header = "circuit_id,psa_id,prob_spike,risk_band,hftd_tier,customer_count,critical_customers,county\n";
  const rows = results.map((r) =>
    [
      r.circuit_id ?? "",
      r.psa_id ?? "",
      r.prob_spike != null ? (r.prob_spike * 100).toFixed(2) : "",
      r.risk_band ?? "",
      r.hftd_tier ?? "",
      r.customer_count ?? "",
      r.critical_customers ?? "",
      r.county ?? "",
    ].join(",")
  );
  return header + rows.join("\n");
}

export function formatPsaRiskCsv(results: any[]): string {
  const header = "circuit_id,psa_id,prob_above_normal,risk_bucket,hftd_tier,customer_count,county,voltage_kv\n";
  const rows = results.map((r) =>
    [
      r.circuit_id ?? "",
      r.psa_id ?? "",
      r.prob_above_normal != null ? (r.prob_above_normal * 100).toFixed(2) : "",
      r.risk_bucket ?? "",
      r.hftd_tier ?? "",
      r.customer_count ?? "",
      r.county ?? "",
      r.voltage_kv ?? "",
    ].join(",")
  );
  return header + rows.join("\n");
}
