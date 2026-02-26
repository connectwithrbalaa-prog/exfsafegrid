import type { Customer } from "@/lib/customer-types";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Phone,
  Clock,
  Users,
  ExternalLink,
  Building2,
  ShieldCheck,
} from "lucide-react";

interface Props {
  customer: Customer;
}

interface CrcInfo {
  name: string;
  address: string;
  phone: string;
  hours: string;
  capacity: string;
  services: string[];
}

function deriveCrc(c: Customer): CrcInfo | null {
  const loc = c.nearest_crc_location;
  if (!loc || loc === "None" || loc === "") return null;

  // Parse from the nearest_crc_location field or provide sensible defaults
  return {
    name: loc,
    address: `Near ZIP ${c.zip_code}`,
    phone: "(800) 743-5000",
    hours: "8:00 AM – 10:00 PM",
    capacity: "120 seats",
    services: ["Device charging", "Wi-Fi", "Water & snacks", "Medical support", "ADA accessible"],
  };
}

interface LocalResource {
  label: string;
  value: string;
  icon: React.ElementType;
  href?: string;
}

function deriveLocalResources(c: Customer): LocalResource[] {
  const resources: LocalResource[] = [
    {
      label: "PSPS Hotline",
      value: "1-800-743-5002",
      icon: Phone,
    },
    {
      label: "Outage Center",
      value: "pge.com/outages",
      icon: ExternalLink,
      href: "https://www.pge.com/en/outages-and-safety/outage-resources.html",
    },
    {
      label: "Local Fire Authority",
      value: `CAL FIRE — ${c.region}`,
      icon: ShieldCheck,
      href: "https://www.fire.ca.gov/",
    },
  ];
  return resources;
}

export default function LocalSupportCard({ customer }: Props) {
  const crc = deriveCrc(customer);
  const resources = deriveLocalResources(customer);

  return (
    <div className="space-y-4">
      {/* CRC Section */}
      {crc ? (
        <div className="p-3 rounded-lg border border-border bg-card/50 space-y-2.5">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Nearest CRC</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto">Open</Badge>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="text-foreground">{crc.name}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="w-3 h-3 flex-shrink-0" />
              <span className="text-foreground">{crc.phone}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-3 h-3 flex-shrink-0" />
              <span className="text-foreground">{crc.hours}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="w-3 h-3 flex-shrink-0" />
              <span className="text-foreground">{crc.capacity}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {crc.services.map((s) => (
              <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg border border-border bg-muted/30 text-center">
          <p className="text-xs text-muted-foreground">No CRC assigned for this customer's area</p>
        </div>
      )}

      {/* Local Resources */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Resources</p>
        {resources.map((r) => (
          <div
            key={r.label}
            className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-card/50 hover:bg-muted/30 transition-colors"
          >
            <r.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground">{r.label}</p>
              {r.href ? (
                <a
                  href={r.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary hover:underline"
                >
                  {r.value} ↗
                </a>
              ) : (
                <p className="text-[11px] text-muted-foreground">{r.value}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
