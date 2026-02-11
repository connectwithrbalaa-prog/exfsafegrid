import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Customer } from "@/lib/customer-types";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, DollarSign, HandHelping, Leaf, ExternalLink } from "lucide-react";

interface Props {
  customer: Customer;
}

type RequestType = "outage_report" | "bill_inquiry" | "assistance_application" | "demand_response";

const QUICK_LINKS: {
  label: string;
  type: RequestType | "external";
  icon: React.ElementType;
  href?: string;
}[] = [
  { label: "Report an outage", type: "outage_report", icon: AlertTriangle },
  { label: "View my bill", type: "bill_inquiry", icon: DollarSign },
  { label: "Apply for assistance", type: "assistance_application", icon: HandHelping },
  {
    label: "Wildfire safety tips",
    type: "external",
    icon: ExternalLink,
    href: "https://www.pge.com/en/outages-and-safety/safety/wildfire-safety.html",
  },
  { label: "Demand response enrollment", type: "demand_response", icon: Leaf },
];

export default function CustomerRequestForms({ customer }: Props) {
  return (
    <ul className="space-y-2">
      {QUICK_LINKS.map((link) =>
        link.type === "external" ? (
          <li key={link.label}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-2 text-left text-sm px-3 py-2 rounded-md hover:bg-secondary text-foreground transition-colors"
            >
              <link.icon className="w-4 h-4 text-muted-foreground" />
              {link.label} ↗
            </a>
          </li>
        ) : (
          <li key={link.label}>
            <RequestFormDialog
              customer={customer}
              requestType={link.type}
              label={link.label}
              icon={link.icon}
            />
          </li>
        )
      )}
    </ul>
  );
}

function RequestFormDialog({
  customer,
  requestType,
  label,
  icon: Icon,
}: {
  customer: Customer;
  requestType: RequestType;
  label: string;
  icon: React.ElementType;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (formData: Record<string, string>) => {
    setSubmitting(true);
    const { error } = await supabase.from("customer_requests").insert({
      customer_id: customer.id,
      customer_name: customer.name,
      request_type: requestType,
      details: formData,
    } as any);
    setSubmitting(false);
    if (error) {
      toast.error("Failed to submit request");
      return;
    }
    toast.success("Request submitted! An agent will review it shortly.");
    setSubmitted(true);
    setTimeout(() => {
      setOpen(false);
      setSubmitted(false);
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSubmitted(false); }}>
      <DialogTrigger asChild>
        <button className="w-full flex items-center gap-2 text-left text-sm px-3 py-2 rounded-md hover:bg-secondary text-foreground transition-colors">
          <Icon className="w-4 h-4 text-muted-foreground" />
          {label}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-primary" />
            {label}
          </DialogTitle>
        </DialogHeader>
        {submitted ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-2xl">✅</p>
            <p className="text-sm font-medium text-foreground">Request submitted successfully!</p>
            <p className="text-xs text-muted-foreground">An agent will review and respond to your request.</p>
          </div>
        ) : (
          <FormFields requestType={requestType} customer={customer} onSubmit={handleSubmit} submitting={submitting} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FormFields({
  requestType,
  customer,
  onSubmit,
  submitting,
}: {
  requestType: RequestType;
  customer: Customer;
  onSubmit: (data: Record<string, string>) => void;
  submitting: boolean;
}) {
  const [fields, setFields] = useState<Record<string, string>>({});

  const update = (key: string, value: string) => setFields((p) => ({ ...p, [key]: value }));

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(fields);
  };

  const inputClass = "w-full px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      {requestType === "outage_report" && (
        <>
          <Field label="Your Address">
            <input required className={inputClass} placeholder="123 Main St" value={fields.address || ""} onChange={(e) => update("address", e.target.value)} />
          </Field>
          <Field label="Outage Description">
            <textarea required className={`${inputClass} resize-none h-20`} placeholder="Describe what happened (lights flickering, total blackout, etc.)" value={fields.description || ""} onChange={(e) => update("description", e.target.value)} />
          </Field>
          <Field label="How many units affected?">
            <select className={inputClass} value={fields.units || "1"} onChange={(e) => update("units", e.target.value)}>
              <option value="1">Just my unit</option>
              <option value="building">Entire building</option>
              <option value="block">Entire block/neighborhood</option>
              <option value="unknown">Not sure</option>
            </select>
          </Field>
          <Field label="Is anyone in danger? (downed wires, sparking, etc.)">
            <select className={inputClass} value={fields.danger || "no"} onChange={(e) => update("danger", e.target.value)}>
              <option value="no">No</option>
              <option value="yes">Yes — Please also call 911</option>
            </select>
          </Field>
        </>
      )}

      {requestType === "bill_inquiry" && (
        <>
          <div className="p-3 rounded-md bg-muted text-xs space-y-1">
            <p><strong>Account:</strong> {customer.name}</p>
            <p><strong>Bill Trend:</strong> {customer.bill_trend}</p>
            <p><strong>Arrears:</strong> {customer.arrears_status === "Yes" ? `$${customer.arrears_amount}` : "None"}</p>
          </div>
          <Field label="What's your billing question?">
            <select className={inputClass} value={fields.inquiry_type || ""} onChange={(e) => update("inquiry_type", e.target.value)}>
              <option value="">Select a topic</option>
              <option value="high_bill">My bill is higher than expected</option>
              <option value="payment_plan">I need a payment plan</option>
              <option value="charges">I don't understand a charge</option>
              <option value="credit">I'm missing a credit/rebate</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Additional details">
            <textarea className={`${inputClass} resize-none h-20`} placeholder="Provide more details about your billing concern..." value={fields.details || ""} onChange={(e) => update("details", e.target.value)} />
          </Field>
        </>
      )}

      {requestType === "assistance_application" && (
        <>
          <Field label="Assistance Program">
            <select required className={inputClass} value={fields.program || ""} onChange={(e) => update("program", e.target.value)}>
              <option value="">Select a program</option>
              <option value="CARE">CARE (20% discount)</option>
              <option value="FERA">FERA (18% discount)</option>
              <option value="REACH">REACH (one-time bill credit)</option>
              <option value="LIHEAP">LIHEAP (federal assistance)</option>
              <option value="medical_baseline">Medical Baseline Allowance</option>
            </select>
          </Field>
          <Field label="Household Size">
            <input required type="number" min="1" max="20" className={inputClass} placeholder="Number of people in household" value={fields.household_size || ""} onChange={(e) => update("household_size", e.target.value)} />
          </Field>
          <Field label="Annual Household Income (approx.)">
            <input required className={inputClass} placeholder="$35,000" value={fields.income || ""} onChange={(e) => update("income", e.target.value)} />
          </Field>
          <Field label="Additional Information">
            <textarea className={`${inputClass} resize-none h-16`} placeholder="Any other details that may help your application..." value={fields.notes || ""} onChange={(e) => update("notes", e.target.value)} />
          </Field>
        </>
      )}

      {requestType === "demand_response" && (
        <>
          <div className="p-3 rounded-md bg-muted text-xs space-y-1 text-muted-foreground">
            <p>Enroll in demand response to earn credits by reducing energy use during peak hours (4–9 PM).</p>
          </div>
          <Field label="Program Preference">
            <select required className={inputClass} value={fields.program || ""} onChange={(e) => update("program", e.target.value)}>
              <option value="">Select a program</option>
              <option value="SmartAC">SmartAC (AC cycling)</option>
              <option value="SmartRate">SmartRate (event-day pricing)</option>
              <option value="PowerSaver">Power Saver Rewards</option>
            </select>
          </Field>
          <Field label="Do you have a smart thermostat?">
            <select className={inputClass} value={fields.smart_thermostat || "no"} onChange={(e) => update("smart_thermostat", e.target.value)}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
          <Field label="Preferred Contact Method">
            <select className={inputClass} value={fields.contact_method || "email"} onChange={(e) => update("contact_method", e.target.value)}>
              <option value="email">Email</option>
              <option value="sms">Text/SMS</option>
              <option value="phone">Phone Call</option>
            </select>
          </Field>
        </>
      )}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Submitting…" : "Submit Request"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}
