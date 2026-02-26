import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Customer } from "@/lib/customer-types";
import {
  Bell, CheckCircle2, Clock, AlertTriangle, XCircle,
  Mail, MessageSquare, Phone, Zap, ShieldAlert, Radio, RotateCcw
} from "lucide-react";

interface CustomerNotification {
  id: string;
  type: string;
  channel: string;
  status: string;
  message: string | null;
  sent_at: string;
}

/* ── Visual config ── */

const TYPE_CONFIG: Record<string, { icon: typeof Bell; label: string; color: string }> = {
  watch:       { icon: Radio,       label: "Watch",       color: "#FACC15" },
  warning:     { icon: ShieldAlert, label: "Warning",     color: "#F97316" },
  shutoff:     { icon: Zap,         label: "Shutoff",     color: "#EF4444" },
  restoration: { icon: RotateCcw,   label: "Restoration", color: "#22C55E" },
};

const CHANNEL_CONFIG: Record<string, { icon: typeof Mail; label: string }> = {
  sms:   { icon: MessageSquare, label: "SMS" },
  email: { icon: Mail,          label: "Email" },
  voice: { icon: Phone,         label: "Voice" },
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; className: string }> = {
  delivered: { icon: CheckCircle2, className: "text-emerald-500" },
  sent:      { icon: Clock,        className: "text-amber-500" },
  failed:    { icon: XCircle,      className: "text-destructive" },
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

interface Props {
  customer: Customer;
}

export default function NotificationHistoryCard({ customer }: Props) {
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("customer_notifications")
        .select("*")
        .eq("customer_id", customer.id)
        .order("sent_at", { ascending: false })
        .limit(5);

      setNotifications((data as CustomerNotification[]) ?? []);
      setLoading(false);
    };
    load();
  }, [customer.id]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No notifications sent to this customer</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      {/* Vertical timeline line */}
      <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border" />

      <div className="space-y-1">
        {notifications.map((n, idx) => {
          const typeConf = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.watch;
          const channelConf = CHANNEL_CONFIG[n.channel] ?? CHANNEL_CONFIG.sms;
          const statusConf = STATUS_CONFIG[n.status] ?? STATUS_CONFIG.sent;
          const TypeIcon = typeConf.icon;
          const ChannelIcon = channelConf.icon;
          const StatusIcon = statusConf.icon;

          return (
            <div key={n.id} className="relative group">
              {/* Timeline dot */}
              <div
                className="absolute -left-6 top-3 w-[22px] h-[22px] rounded-full border-2 border-background flex items-center justify-center z-10"
                style={{ background: typeConf.color }}
              >
                <TypeIcon className="w-3 h-3 text-white" />
              </div>

              {/* Card */}
              <div className="ml-2 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                    style={{ background: `${typeConf.color}18`, color: typeConf.color }}
                  >
                    {typeConf.label}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <ChannelIcon className="w-3 h-3" />
                    {channelConf.label}
                  </span>
                  <span className={`flex items-center gap-1 text-[10px] ${statusConf.className}`}>
                    <StatusIcon className="w-3 h-3" />
                    {n.status.charAt(0).toUpperCase() + n.status.slice(1)}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground" title={formatFullDate(n.sent_at)}>
                    {formatTime(n.sent_at)}
                  </span>
                </div>
                {n.message && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                    {n.message}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
