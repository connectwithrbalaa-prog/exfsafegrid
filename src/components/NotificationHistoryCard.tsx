import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Customer } from "@/lib/customer-types";
import { Bell, CheckCircle2, Clock, AlertTriangle, Mail, MessageSquare, Smartphone } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  severity: string;
  alert_type: string;
  delivery_status: string;
  created_at: string;
  recipients_count: number;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  info: "bg-info/10 text-info border-info/30",
};

const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  delivered: CheckCircle2,
  pending: Clock,
  failed: AlertTriangle,
};

const CHANNEL_ICON: Record<string, typeof Mail> = {
  email: Mail,
  sms: Smartphone,
  push: Bell,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Props {
  customer: Customer;
}

export default function NotificationHistoryCard({ customer }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("community_alerts")
        .select("*")
        .contains("affected_zips", [customer.zip_code])
        .order("created_at", { ascending: false })
        .limit(10);

      setNotifications((data as Notification[]) ?? []);
      setLoading(false);
    };
    fetch();
  }, [customer.zip_code]);

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
        <p className="text-sm">No notifications sent to ZIP {customer.zip_code}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notifications.map((n) => {
        const sevStyle = SEVERITY_STYLES[n.severity] ?? SEVERITY_STYLES.info;
        const StatusIcon = STATUS_ICON[n.delivery_status] ?? Clock;
        const statusColor =
          n.delivery_status === "delivered"
            ? "text-success"
            : n.delivery_status === "failed"
              ? "text-destructive"
              : "text-muted-foreground";

        return (
          <div
            key={n.id}
            className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${sevStyle} transition-colors`}
          >
            <div className="mt-0.5">
              <Bell className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold truncate">{n.title}</span>
                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${sevStyle}`}>
                  {n.severity}
                </span>
              </div>
              <p className="text-[11px] opacity-80 mt-0.5 line-clamp-2">{n.message}</p>
              <div className="flex items-center gap-3 mt-1.5 text-[10px] opacity-60">
                <span className="flex items-center gap-1">
                  <StatusIcon className={`w-3 h-3 ${statusColor}`} />
                  {n.delivery_status}
                </span>
                <span>{n.recipients_count} recipients</span>
                <span>{timeAgo(n.created_at)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
