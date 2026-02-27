/**
 * NotificationAnalyticsDashboard — Delivery stats, channel breakdown, and volume trends.
 * Reads from customer_notifications table.
 */
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3, TrendingUp, CheckCircle2, XCircle, Clock,
  MessageSquare, Mail, Phone, Loader2, RefreshCw
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie
} from "recharts";

interface Notification {
  id: string;
  type: string;
  channel: string;
  status: string;
  sent_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  delivered: "hsl(142,71%,45%)",
  sent: "hsl(38,92%,50%)",
  failed: "hsl(0,84%,60%)",
};

const CHANNEL_META: Record<string, { icon: typeof Mail; label: string; color: string }> = {
  sms:   { icon: MessageSquare, label: "SMS",   color: "hsl(217,91%,60%)" },
  email: { icon: Mail,          label: "Email", color: "hsl(262,83%,58%)" },
  voice: { icon: Phone,         label: "Voice", color: "hsl(38,92%,50%)" },
};

const TYPE_COLORS: Record<string, string> = {
  watch: "hsl(48,96%,53%)",
  warning: "hsl(25,95%,53%)",
  shutoff: "hsl(0,84%,60%)",
  restoration: "hsl(142,71%,45%)",
  fire_proximity: "hsl(15,90%,55%)",
  medical_baseline: "hsl(262,83%,58%)",
};

export default function NotificationAnalyticsDashboard() {
  const [data, setData] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from("customer_notifications")
      .select("id, type, channel, status, sent_at")
      .order("sent_at", { ascending: false })
      .limit(1000);
    setData((rows as Notification[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Derived stats ──
  const stats = useMemo(() => {
    const total = data.length;
    const delivered = data.filter((n) => n.status === "delivered").length;
    const failed = data.filter((n) => n.status === "failed").length;
    const pending = data.filter((n) => n.status === "sent").length;
    return { total, delivered, failed, pending, rate: total ? ((delivered / total) * 100).toFixed(1) : "0" };
  }, [data]);

  // Channel breakdown for pie chart
  const channelBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((n) => { map[n.channel] = (map[n.channel] || 0) + 1; });
    return Object.entries(map).map(([channel, count]) => ({
      name: CHANNEL_META[channel]?.label ?? channel,
      value: count,
      color: CHANNEL_META[channel]?.color ?? "hsl(220,10%,50%)",
    }));
  }, [data]);

  // Type breakdown
  const typeBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((n) => { map[n.type] = (map[n.type] || 0) + 1; });
    return Object.entries(map)
      .map(([type, count]) => ({ type: type.charAt(0).toUpperCase() + type.slice(1), count, color: TYPE_COLORS[type] ?? "hsl(220,10%,50%)" }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  // Daily volume trend (last 14 days)
  const dailyTrend = useMemo(() => {
    const map: Record<string, { date: string; delivered: number; sent: number; failed: number }> = {};
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map[key] = { date: key, delivered: 0, sent: 0, failed: 0 };
    }
    data.forEach((n) => {
      const day = n.sent_at.slice(0, 10);
      if (map[day]) {
        if (n.status === "delivered") map[day].delivered++;
        else if (n.status === "failed") map[day].failed++;
        else map[day].sent++;
      }
    });
    return Object.values(map);
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading analytics…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          Notification Analytics
        </h3>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/[0.03] text-white/50 border border-white/[0.08] hover:bg-white/[0.06] transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Sent", value: stats.total, icon: TrendingUp, color: "text-blue-400" },
          { label: "Delivered", value: stats.delivered, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Failed", value: stats.failed, icon: XCircle, color: "text-red-400" },
          { label: "Delivery Rate", value: `${stats.rate}%`, icon: CheckCircle2, color: "text-amber-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
              <span className="text-[10px] text-white/40 uppercase tracking-wider">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold text-white/90">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Volume Trend */}
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Daily Volume (14 days)</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={dailyTrend}>
            <defs>
              <linearGradient id="gradDelivered" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142,71%,45%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(142,71%,45%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fill: "hsl(220,10%,45%)", fontSize: 10 }}
              tickFormatter={(v: string) => v.slice(5)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "hsl(220,10%,45%)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip
              contentStyle={{ background: "hsl(220,25%,12%)", border: "1px solid hsl(220,10%,20%)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "hsl(220,10%,70%)" }}
            />
            <Area type="monotone" dataKey="delivered" stroke="hsl(142,71%,45%)" fill="url(#gradDelivered)" strokeWidth={2} />
            <Area type="monotone" dataKey="sent" stroke="hsl(38,92%,50%)" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
            <Area type="monotone" dataKey="failed" stroke="hsl(0,84%,60%)" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom row: Channel pie + Type breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Channel Pie */}
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-3">By Channel</p>
          {channelBreakdown.length === 0 ? (
            <p className="text-xs text-white/30 py-8 text-center">No data</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={channelBreakdown} dataKey="value" innerRadius={30} outerRadius={55} paddingAngle={3} strokeWidth={0}>
                    {channelBreakdown.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {channelBreakdown.map((ch) => (
                  <div key={ch.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: ch.color }} />
                    <span className="text-white/60">{ch.name}</span>
                    <span className="text-white/90 font-semibold ml-auto">{ch.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Type Bar */}
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-3">By Type</p>
          {typeBreakdown.length === 0 ? (
            <p className="text-xs text-white/30 py-8 text-center">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={typeBreakdown} layout="vertical">
                <XAxis type="number" hide />
                <YAxis
                  dataKey="type"
                  type="category"
                  tick={{ fill: "hsl(220,10%,60%)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <Tooltip
                  contentStyle={{ background: "hsl(220,25%,12%)", border: "1px solid hsl(220,10%,20%)", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14}>
                  {typeBreakdown.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Empty state */}
      {data.length === 0 && (
        <div className="text-center py-10 text-white/30">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No notifications sent yet</p>
          <p className="text-xs mt-1">Use the Send tab to compose and deliver notifications</p>
        </div>
      )}
    </div>
  );
}
