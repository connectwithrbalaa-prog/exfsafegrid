import { useState } from "react";
import { useRiskThresholds, useUpdateThreshold, type RiskThreshold } from "@/hooks/use-risk-thresholds";
import { Settings, Loader2, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const MODEL_LABELS: Record<string, string> = {
  ignition_spike: "Circuit Ignition Spike",
  psa_risk: "PSA Activity Risk",
  fire_spread: "Fire Spread & Behavior",
};

export default function RiskThresholdSettings() {
  const { data: thresholds, isLoading } = useRiskThresholds();
  const updateMut = useUpdateThreshold();
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-white/30">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading thresholds…
      </div>
    );
  }

  if (!thresholds?.length) {
    return (
      <div className="p-4 rounded-lg border border-white/[0.08] bg-white/[0.02] text-xs text-white/40">
        No risk thresholds configured.
      </div>
    );
  }

  // Group by model
  const grouped = thresholds.reduce<Record<string, RiskThreshold[]>>((acc, t) => {
    (acc[t.model_name] ||= []).push(t);
    return acc;
  }, {});

  const hasEdits = Object.keys(edits).length > 0;

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      for (const [id, val] of Object.entries(edits)) {
        await updateMut.mutateAsync({ id, min_probability: val });
      }
      setEdits({});
      toast.success("Risk thresholds updated");
    } catch (e: any) {
      toast.error(`Failed to save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Settings className="w-4 h-4 text-amber-400" />
          Risk Threshold Configuration
        </h3>
        <div className="flex items-center gap-2">
          {hasEdits && (
            <button
              onClick={() => setEdits({})}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/[0.03] text-white/40 border border-white/[0.08] hover:bg-white/[0.06] transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
          <button
            onClick={handleSaveAll}
            disabled={!hasEdits || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save Changes
          </button>
        </div>
      </div>

      <p className="text-[11px] text-white/30">
        Adjust the minimum probability cutoffs for each risk band. Values represent the lower bound — a circuit scoring at or above this value is classified into this band.
      </p>

      {Object.entries(grouped).map(([model, bands]) => (
        <div key={model} className="rounded-lg border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
            <span className="text-xs font-semibold">{MODEL_LABELS[model] || model}</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {bands.map((t) => {
              const currentVal = edits[t.id] ?? t.min_probability;
              const isEdited = edits[t.id] !== undefined;
              return (
                <div key={t.id} className="flex items-center gap-4 px-4 py-3">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: t.color_hex }}
                  />
                  <span className="text-xs font-semibold w-20">{t.band_name}</span>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-[10px] text-white/30 w-6 text-right">≥</span>
                    <input
                      type="number"
                      step={model === "fire_spread" ? 0.5 : 0.01}
                      min={0}
                      max={model === "fire_spread" ? 100 : 1}
                      value={currentVal}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          setEdits((prev) => ({ ...prev, [t.id]: val }));
                        }
                      }}
                      className={`w-24 px-2 py-1.5 rounded-md text-xs font-mono border bg-white/[0.03] outline-none transition-colors ${
                        isEdited
                          ? "border-amber-500/40 text-amber-200"
                          : "border-white/[0.08] text-white/70"
                      } focus:border-white/30`}
                    />
                    <span className="text-[10px] text-white/20">
                      {model === "fire_spread" ? "ch/hr" : "probability"}
                    </span>
                  </div>
                  {isEdited && (
                    <span className="text-[10px] text-amber-400 font-medium">modified</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="text-[10px] text-white/20 leading-relaxed">
        <strong>Note:</strong> Changes apply globally to all risk displays. The backend Python models also use these thresholds when deployed with the updated configuration endpoint.
      </div>
    </div>
  );
}
