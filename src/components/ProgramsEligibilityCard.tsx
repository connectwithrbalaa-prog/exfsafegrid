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
  prefillType?: "assistance_application";
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
      prefillType: "assistance_application",
    },
  ];
}

export default function ProgramsEligibilityCard({ customer }: Props) {
  const [openForm, setOpenForm] = useState(false);
  const programs = derivePrograms(customer);

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
                  onClick={() => setOpenForm(true)}
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
            <DialogTitle>Apply for Program</DialogTitle>
          </DialogHeader>
          <CustomerRequestForms customer={customer} />
        </DialogContent>
      </Dialog>
    </>
  );
}
