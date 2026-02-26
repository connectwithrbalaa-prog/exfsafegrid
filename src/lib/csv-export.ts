/**
 * Generic CSV export utility for risk ranking tables.
 */

export function downloadCsv(rows: Record<string, any>[], filename: string) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val == null) return "";
          const str = String(val);
          // Escape quotes & wrap if contains comma/quote/newline
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(",")
    ),
  ];

  const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Format circuit ignition risk results for CSV export */
export function formatCircuitRiskCsv(results: any[]) {
  return results.map((r) => ({
    circuit_id: r.circuit_id,
    psa_id: r.psa_id,
    prob_spike: r.prob_spike != null ? (r.prob_spike * 100).toFixed(1) + "%" : "",
    risk_band: r.risk_band || "",
    hftd_tier: r.hftd_tier || "",
    customer_count: r.customer_count ?? "",
    county: r.county || "",
  }));
}

/** Format PSA risk results for CSV export */
export function formatPsaRiskCsv(results: any[]) {
  return results.map((r) => ({
    circuit_id: r.circuit_id,
    psa_id: r.psa_id,
    prob_above_normal: r.prob_above_normal != null ? (r.prob_above_normal * 100).toFixed(1) + "%" : "",
    risk_bucket: r.risk_bucket || "",
    hftd_tier: r.hftd_tier || "",
    customer_count: r.customer_count ?? "",
    county: r.county || "",
    drivers: typeof r.drivers === "object" ? JSON.stringify(r.drivers) : r.drivers || "",
  }));
}

/** Format asset risk table for CSV export */
export function formatAssetRiskCsv(assets: any[]) {
  return assets.map((a) => ({
    asset_name: a.name,
    type: a.type,
    voltage: a.voltage,
    risk_level: a.risk,
    nearest_fire_km: a.fireDistance != null ? a.fireDistance.toFixed(1) : "",
    action: a.action,
  }));
}
