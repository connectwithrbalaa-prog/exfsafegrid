import { useState } from "react";
import type { Customer } from "@/lib/customer-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CustomerRequestForms from "@/components/CustomerRequestForms";
import { toast } from "sonner";
import {
  Battery,
  HeartPulse,
  Zap,
  Leaf,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from "lucide-react";

interface Props {
  customer: Customer;
}

interface ProgramInfo {
  key: string;
  label: string;
  icon: React.ElementType;
  eligible: boolean;
  reason: string;
  enrolled?: boolean;
  enrollLabel?: string;
  prefillType?: "assistance_application" | "generator_rebate";
}

function derivePrograms(c: Customer): ProgramInfo[] {
  const hasHighRisk = c.wildfire_risk === "High" || c.hftd_tier.includes("3");
  const hasOutages = c.current_outage_status !== "Normal" || (c.outage_history && c.outage_history !== "None" && c.outage_history !== "");
  const noBattery = !c.has_portable_battery && c.has_permanent_battery === "None";

  return [
    {
      key: "backup_power",
      label: "Backup Power Program",
      icon: Battery,
      eligible: hasHighRisk && noBattery,
      reason: hasHighRisk && noBattery
        ? "High-risk area with no backup power"
        : !hasHighRisk
          ? "Not in a high-risk fire zone"
          : "Already has backup power equipment",
      enrollLabel: "Apply for battery",
      prefillType: "assistance_application",
    },
    {
      key: "medical_baseline",
      label: "Medical Baseline",
      icon: HeartPulse,
      eligible: !c.medical_baseline,
      enrolled: c.medical_baseline,
      reason: c.medical_baseline
        ? "Currently enrolled — priority notifications active"
        : "Not enrolled — start enrollment for priority safety protocols",
      enrollLabel: "Start enrollment",
      prefillType: "assistance_application",
    },
    {
      key: "generator_rebate",
      label: "Generator Rebate",
      icon: Zap,
      eligible: hasHighRisk && (!!hasOutages || noBattery),
      reason:
        hasHighRisk && (!!hasOutages || noBattery)
          ? "Qualifies based on fire risk and outage history"
          : !hasHighRisk
            ? "Not in a qualifying high-risk zone"
            : "No recent outage history or already has backup",
      enrollLabel: "Apply for rebate",
      prefillType: "generator_rebate",
    },
  ];
}

export default function ProgramsEligibilityCard({ customer }: Props) {
  const [openForm, setOpenForm] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<ProgramInfo | null>(null);
  const programs = derivePrograms(customer);

  const handleApply = (program: ProgramInfo) => {
    setSelectedProgram(program);
    setOpenForm(true);
  };

  return (
    <>
      <div className="space-y-3">
        {programs.map((p) => {
          const StatusIcon = p.enrolled ? CheckCircle2 : p.eligible ? CheckCircle2 : XCircle;
          const statusColor = p.enrolled
            ? "text-info"
            : p.eligible
              ? "text-success"
              : "text-muted-foreground";

          return (
            <div
              key={p.key}
              className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted flex-shrink-0 mt-0.5">
                <p.icon className="w-4 h-4 text-muted-foreground" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">{p.label}</span>
                  <Badge
                    variant={p.enrolled ? "default" : p.eligible ? "secondary" : "outline"}
                    className="text-[10px] px-1.5 py-0"
                  >
                    <StatusIcon className={`w-3 h-3 mr-1 ${statusColor}`} />
                    {p.enrolled ? "Enrolled" : p.eligible ? "Eligible" : "Not Eligible"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{p.reason}</p>
              </div>

              {(p.eligible || (!p.enrolled && p.key === "medical_baseline")) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0 text-xs h-8 gap-1"
                  onClick={() => handleApply(p)}
                >
                  {p.enrollLabel}
                  <ChevronRight className="w-3 h-3" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedProgram && <selectedProgram.icon className="w-5 h-5 text-primary" />}
              {selectedProgram?.prefillType === "generator_rebate"
                ? "Apply for Generator Rebate"
                : "Apply for Program"}
            </DialogTitle>
          </DialogHeader>
          {selectedProgram?.prefillType === "generator_rebate" ? (
            <GeneratorRebateForm customer={customer} onClose={() => setOpenForm(false)} />
          ) : (
            <CustomerRequestForms customer={customer} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function GeneratorRebateForm({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({
    generator_type: "",
    generator_size: "",
    purchase_status: "",
    address: "",
    notes: "",
  });

  const update = (key: string, value: string) => setFields((p) => ({ ...p, [key]: value }));

  const inputClass = "w-full px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await (await import("@/integrations/supabase/client")).supabase
      .from("customer_requests")
      .insert({
        customer_id: customer.id,
        customer_name: customer.name,
        request_type: "generator_rebate",
        details: fields,
      } as any);
    setSubmitting(false);
    if (error) {
      toast.error("Failed to submit application");
      return;
    }
    toast.success("Generator rebate application submitted!");
    setSubmitted(true);
    setTimeout(() => onClose(), 2000);
  };

  if (submitted) {
    return (
      <div className="py-8 text-center space-y-2">
        <p className="text-2xl">✅</p>
        <p className="text-sm font-medium text-foreground">Application submitted successfully!</p>
        <p className="text-xs text-muted-foreground">An agent will review your generator rebate application and follow up.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 rounded-md bg-muted text-xs space-y-1 text-muted-foreground">
        <p><strong className="text-foreground">Applicant:</strong> {customer.name}</p>
        <p><strong className="text-foreground">ZIP Code:</strong> {customer.zip_code}</p>
        <p><strong className="text-foreground">HFTD Tier:</strong> {customer.hftd_tier}</p>
        <p><strong className="text-foreground">Risk Level:</strong> {customer.wildfire_risk}</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Generator Type</label>
        <select required className={inputClass} value={fields.generator_type} onChange={(e) => update("generator_type", e.target.value)}>
          <option value="">Select type</option>
          <option value="portable_gas">Portable — Gasoline</option>
          <option value="portable_propane">Portable — Propane</option>
          <option value="portable_dual">Portable — Dual Fuel</option>
          <option value="standby">Standby / Whole-Home</option>
          <option value="solar_battery">Solar + Battery System</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Generator Size (Watts)</label>
        <select required className={inputClass} value={fields.generator_size} onChange={(e) => update("generator_size", e.target.value)}>
          <option value="">Select size</option>
          <option value="under_3000">Under 3,000W</option>
          <option value="3000_5000">3,000 – 5,000W</option>
          <option value="5000_10000">5,000 – 10,000W</option>
          <option value="over_10000">Over 10,000W</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Purchase Status</label>
        <select required className={inputClass} value={fields.purchase_status} onChange={(e) => update("purchase_status", e.target.value)}>
          <option value="">Select status</option>
          <option value="not_purchased">Not yet purchased</option>
          <option value="purchased_30">Purchased within last 30 days</option>
          <option value="purchased_90">Purchased within last 90 days</option>
          <option value="purchased_older">Purchased more than 90 days ago</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Installation Address</label>
        <input required className={inputClass} placeholder="123 Main St, City, CA" value={fields.address} onChange={(e) => update("address", e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Additional Notes</label>
        <textarea className={`${inputClass} resize-none h-16`} placeholder="Any other details (e.g. medical equipment needs, transfer switch installed)..." value={fields.notes} onChange={(e) => update("notes", e.target.value)} />
      </div>

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Submitting…" : "Submit Rebate Application"}
      </Button>
    </form>
  );
}
