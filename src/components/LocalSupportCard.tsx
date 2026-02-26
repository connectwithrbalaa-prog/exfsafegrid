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
  Heart,
  UtensilsCrossed,
  Thermometer,
} from "lucide-react";

interface Props {
  customer: Customer;
}

/* ── Static ZIP → local-resource mapping ── */

interface LocalResource {
  name: string;
  type: "CRC" | "Food Bank" | "Cooling Center" | "Medical Support";
  address: string;
  phone: string;
}

const ZIP_RESOURCES: Record<string, LocalResource[]> = {
  "94611": [
    { name: "Oakland Hills CRC", type: "CRC", address: "4344 Walnut St, Oakland CA 94611", phone: "(510) 555-0140" },
    { name: "Montclair Food Pantry", type: "Food Bank", address: "1860 Mountain Blvd, Oakland CA 94611", phone: "(510) 555-0188" },
    { name: "Alta Bates Medical Aid", type: "Medical Support", address: "350 Hawthorne Ave, Oakland CA 94609", phone: "(510) 555-0201" },
  ],
  "94301": [
    { name: "Palo Alto CRC", type: "CRC", address: "250 Hamilton Ave, Palo Alto CA 94301", phone: "(650) 555-0122" },
    { name: "Downtown Cooling Center", type: "Cooling Center", address: "270 Grant Ave, Palo Alto CA 94306", phone: "(650) 555-0177" },
  ],
  "95060": [
    { name: "Santa Cruz Civic CRC", type: "CRC", address: "307 Church St, Santa Cruz CA 95060", phone: "(831) 555-0133" },
    { name: "Second Harvest Food Bank", type: "Food Bank", address: "800 Ohlone Pkwy, Watsonville CA 95076", phone: "(831) 555-0199" },
    { name: "SC Community Health", type: "Medical Support", address: "1080 Emeline Ave, Santa Cruz CA 95060", phone: "(831) 555-0210" },
  ],
  "91001": [
    { name: "Altadena CRC", type: "CRC", address: "730 E Altadena Dr, Altadena CA 91001", phone: "(626) 555-0145" },
    { name: "Foothill Unity Food Bank", type: "Food Bank", address: "415 W Chestnut Ave, Monrovia CA 91016", phone: "(626) 555-0166" },
  ],
  "92264": [
    { name: "Palm Springs CRC", type: "CRC", address: "401 S Pavilion Way, Palm Springs CA 92262", phone: "(760) 555-0111" },
    { name: "FIND Food Bank", type: "Food Bank", address: "83775 Citrus Ave, Indio CA 92201", phone: "(760) 555-0188" },
    { name: "Desert Regional Cooling Center", type: "Cooling Center", address: "1150 N Indian Canyon Dr, Palm Springs CA 92262", phone: "(760) 555-0199" },
  ],
  "93001": [
    { name: "Ventura CRC", type: "CRC", address: "500 E Santa Clara St, Ventura CA 93001", phone: "(805) 555-0130" },
    { name: "FOOD Share Ventura", type: "Food Bank", address: "4156 N Southbank Rd, Oxnard CA 93036", phone: "(805) 555-0172" },
  ],
  "95401": [
    { name: "Sonoma County CRC", type: "CRC", address: "1600 Los Alamos Rd, Santa Rosa CA 95409", phone: "(707) 555-0140" },
    { name: "Redwood Empire Food Bank", type: "Food Bank", address: "3990 Brickway Blvd, Santa Rosa CA 95403", phone: "(707) 555-0185" },
    { name: "Sutter Health Cooling Station", type: "Cooling Center", address: "30 Mark West Springs Rd, Santa Rosa CA 95404", phone: "(707) 555-0201" },
  ],
};

/* Fallback resources when ZIP not in static map */
const DEFAULT_RESOURCES: LocalResource[] = [
  { name: "County CRC (Call for location)", type: "CRC", address: "Contact your local utility office", phone: "(800) 743-5000" },
  { name: "CA Food Bank Network", type: "Food Bank", address: "cafoodbanks.org", phone: "(800) 870-3663" },
];

function getResourcesForZip(zip: string): LocalResource[] {
  return ZIP_RESOURCES[zip] ?? DEFAULT_RESOURCES;
}

const TYPE_ICON: Record<LocalResource["type"], React.ElementType> = {
  CRC: Building2,
  "Food Bank": UtensilsCrossed,
  "Cooling Center": Thermometer,
  "Medical Support": Heart,
};

const TYPE_COLOR: Record<LocalResource["type"], string> = {
  CRC: "text-primary",
  "Food Bank": "text-accent-foreground",
  "Cooling Center": "text-blue-500",
  "Medical Support": "text-destructive",
};

/* ── CRC detail section (from nearest_crc_location) ── */

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
  return {
    name: loc,
    address: `Near ZIP ${c.zip_code}`,
    phone: "(800) 743-5000",
    hours: "8:00 AM – 10:00 PM",
    capacity: "120 seats",
    services: ["Device charging", "Wi-Fi", "Water & snacks", "Medical support", "ADA accessible"],
  };
}

/* ── Quick-link resources ── */

interface QuickLink {
  label: string;
  value: string;
  icon: React.ElementType;
  href?: string;
}

function deriveQuickLinks(c: Customer): QuickLink[] {
  return [
    { label: "PSPS Hotline", value: "1-800-743-5002", icon: Phone },
    { label: "Outage Center", value: "pge.com/outages", icon: ExternalLink, href: "https://www.pge.com/en/outages-and-safety/outage-resources.html" },
    { label: "Local Fire Authority", value: `CAL FIRE — ${c.region}`, icon: ShieldCheck, href: "https://www.fire.ca.gov/" },
  ];
}

/* ── Component ── */

export default function LocalSupportCard({ customer }: Props) {
  const crc = deriveCrc(customer);
  const quickLinks = deriveQuickLinks(customer);
  const localResources = getResourcesForZip(customer.zip_code);

  return (
    <div className="space-y-4">
      {/* Nearby Resources by ZIP */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Nearby Resources — ZIP {customer.zip_code}
        </p>
        {localResources.map((r) => {
          const Icon = TYPE_ICON[r.type];
          return (
            <div
              key={r.name}
              className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-border bg-card/50"
            >
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${TYPE_COLOR[r.type]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-foreground truncate">{r.name}</p>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal flex-shrink-0">
                    {r.type}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" /> {r.address}
                </p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3 flex-shrink-0" /> {r.phone}
                </p>
              </div>
            </div>
          );
        })}
      </div>

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

      {/* Quick Links */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Resources</p>
        {quickLinks.map((r) => (
          <div
            key={r.label}
            className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-card/50 hover:bg-muted/30 transition-colors"
          >
            <r.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground">{r.label}</p>
              {r.href ? (
                <a href={r.href} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline">
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
