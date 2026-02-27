import { Copy, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import RiskBadge from "@/components/RiskBadge";
import DriverChips from "@/components/DriverChips";
import { toast } from "sonner";

interface DetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: Record<string, any> | null;
  probField: string;
  riskField: string;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

export default function DetailsDrawer({
  open,
  onOpenChange,
  row,
  probField,
  riskField,
}: DetailsDrawerProps) {
  if (!row) return null;

  function copyJson() {
    navigator.clipboard.writeText(JSON.stringify(row, null, 2));
    toast.success("JSON copied to clipboard");
  }

  const prob = row[probField];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto w-full sm:max-w-md bg-background">
        <SheetHeader className="flex flex-row items-center justify-between">
          <SheetTitle className="text-base">
            Circuit {row.circuit_id ?? "—"}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Circuit & Location */}
          <Section title="Circuit & Location">
            <Field label="Circuit ID">{row.circuit_id ?? "—"}</Field>
            <Field label="PSA">{row.psa_id ?? "—"}</Field>
            <Field label="County">{row.county ?? "—"}</Field>
            <Field label="HFTD Tier">{row.hftd_tier ?? "—"}</Field>
            {row.voltage_kv != null && <Field label="Voltage (kV)">{row.voltage_kv}</Field>}
          </Section>

          {/* Risk Assessment */}
          <Section title="Risk Assessment">
            <Field label="Probability">
              {prob != null ? (prob * 100).toFixed(1) + "%" : "—"}
            </Field>
            <Field label="Risk Level">
              <RiskBadge level={row[riskField]} />
            </Field>
          </Section>

          {/* Exposure */}
          <Section title="Exposure">
            <Field label="Customers">{row.customer_count?.toLocaleString() ?? "—"}</Field>
            {row.critical_customers != null && (
              <Field label="Critical Customers">{row.critical_customers.toLocaleString()}</Field>
            )}
          </Section>

          {/* Drivers */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
              Drivers
            </h3>
            <DriverChips drivers={row.drivers} />
          </div>

          {/* Metadata */}
          <Section title="Metadata">
            {Object.entries(row)
              .filter(
                ([k]) =>
                  ![
                    "circuit_id",
                    "psa_id",
                    "county",
                    "hftd_tier",
                    "voltage_kv",
                    probField,
                    riskField,
                    "customer_count",
                    "critical_customers",
                    "drivers",
                  ].includes(k),
              )
              .map(([k, v]) => (
                <Field key={k} label={k}>
                  {String(v ?? "—")}
                </Field>
              ))}
          </Section>

          <Button variant="outline" size="sm" className="w-full" onClick={copyJson}>
            <Copy className="mr-2 h-3.5 w-3.5" />
            Copy JSON
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
