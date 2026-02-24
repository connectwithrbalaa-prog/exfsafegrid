/**
 * SmsAlertsPanel — Two-Way Customer SMS/Push Alerts
 *
 * Technical approach:
 * - Simulates inbound reply parsing (CONFIRM / HELP / STOP keywords)
 * - Delivery receipt tracking visible to agents in real-time
 * - Alert deduplication: prevents >1 alert per customer per 60-min window
 * - Two-way flow: outbound alert → customer reply → auto-triage or agent escalation
 * - Integration point: real backend would use Twilio/AWS SNS webhooks writing to
 *   `sms_log` table; Supabase Realtime broadcasts new rows to all agent tabs
 */

import { useState, useMemo } from "react";
import { MessageSquare, CheckCheck, AlertTriangle, Phone, Clock, Send, Filter, X } from "lucide-react";
import { toast } from "sonner";

type ReplyType = "CONFIRM" | "HELP" | "STOP" | "CUSTOM" | null;
type Status = "sent" | "delivered" | "read" | "replied" | "failed" | "deduped";

interface SmsRecord {
  id: string;
  customer_name: string;
  zip_code: string;
  phone: string;
  message: string;
  status: Status;
  sent_at: Date;
  reply?: string;
  reply_type?: ReplyType;
  reply_at?: Date;
  alert_type: "PSPS" | "Fire" | "Restoration" | "Financial";
}

// Simulated alert history — in production, fetched from `sms_log` Supabase table
const MOCK_SMS: SmsRecord[] = [
  {
    id: "sms-1",
    customer_name: "Maria Gonzalez",
    zip_code: "95370",
    phone: "+1 (209) 555-0141",
    message: "PSPS Alert: Your area (ZIP 95370) is scheduled for de-energization at 6:00 PM today. Reply CONFIRM to acknowledge.",
    status: "replied",
    sent_at: new Date(Date.now() - 3600000),
    reply: "CONFIRM",
    reply_type: "CONFIRM",
    reply_at: new Date(Date.now() - 3400000),
    alert_type: "PSPS",
  },
  {
    id: "sms-2",
    customer_name: "James Chen",
    zip_code: "95321",
    phone: "+1 (209) 555-0188",
    message: "Fire Weather Alert: Red Flag conditions in your area. Avoid outdoor activities. Reply HELP if you need assistance.",
    status: "replied",
    sent_at: new Date(Date.now() - 7200000),
    reply: "HELP - I have a medical device that needs power",
    reply_type: "HELP",
    reply_at: new Date(Date.now() - 7000000),
    alert_type: "Fire",
  },
  {
    id: "sms-3",
    customer_name: "Patricia Davis",
    zip_code: "95370",
    phone: "+1 (209) 555-0204",
    message: "PSPS Alert: Your area (ZIP 95370) is scheduled for de-energization at 6:00 PM today. Reply CONFIRM to acknowledge.",
    status: "deduped",
    sent_at: new Date(Date.now() - 3500000),
    alert_type: "PSPS",
  },
  {
    id: "sms-4",
    customer_name: "Robert Kim",
    zip_code: "95321",
    phone: "+1 (209) 555-0167",
    message: "Power Restoration: Your power has been restored. Thank you for your patience.",
    status: "delivered",
    sent_at: new Date(Date.now() - 1800000),
    alert_type: "Restoration",
  },
  {
    id: "sms-5",
    customer_name: "Susan Martinez",
    zip_code: "95383",
    phone: "+1 (209) 555-0233",
    message: "Financial Assistance: You may qualify for the REACH program. Reply HELP to speak with an agent.",
    status: "read",
    sent_at: new Date(Date.now() - 900000),
    alert_type: "Financial",
  },
  {
    id: "sms-6",
    customer_name: "Thomas Anderson",
    zip_code: "95383",
    phone: "+1 (209) 555-0292",
    message: "PSPS Alert: Your area is scheduled for de-energization. Reply CONFIRM to acknowledge.",
    status: "failed",
    sent_at: new Date(Date.now() - 600000),
    alert_type: "PSPS",
  },
];

const STATUS_CONFIG: Record<Status, { icon: React.ReactNode; label: string; badge: string }> = {
  sent:      { icon: <Send className="w-3 h-3" />,        label: "Sent",      badge: "bg-blue-500/15 text-blue-300" },
  delivered: { icon: <CheckCheck className="w-3 h-3" />, label: "Delivered", badge: "bg-sky-500/15 text-sky-300" },
  read:      { icon: <CheckCheck className="w-3 h-3" />, label: "Read",      badge: "bg-emerald-500/15 text-emerald-300" },
  replied:   { icon: <MessageSquare className="w-3 h-3" />, label: "Replied", badge: "bg-purple-500/15 text-purple-300" },
  failed:    { icon: <X className="w-3 h-3" />,           label: "Failed",    badge: "bg-red-500/15 text-red-300" },
  deduped:   { icon: <Filter className="w-3 h-3" />,      label: "Deduped",   badge: "bg-white/10 text-white/30" },
};

const REPLY_CONFIG: Record<NonNullable<ReplyType>, { badge: string; action: string }> = {
  CONFIRM: { badge: "bg-emerald-500/15 text-emerald-300", action: "Auto-acknowledged. No agent action needed." },
  HELP:    { badge: "bg-red-500/15 text-red-300 ring-1 ring-red-500/40", action: "Escalate to agent — customer needs assistance." },
  STOP:    { badge: "bg-gray-500/15 text-gray-300", action: "Customer opted out. Remove from future alerts." },
  CUSTOM:  { badge: "bg-amber-500/15 text-amber-300", action: "Custom reply — review and respond manually." },
};

const ALERT_TYPE_COLORS: Record<SmsRecord["alert_type"], string> = {
  PSPS:        "text-orange-400",
  Fire:        "text-red-400",
  Restoration: "text-emerald-400",
  Financial:   "text-blue-400",
};

function formatRelative(date: Date): string {
  const diff = (Date.now() - date.getTime()) / 60000;
  if (diff < 1) return "just now";
  if (diff < 60) return `${Math.round(diff)}m ago`;
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
  return date.toLocaleDateString();
}

export default function SmsAlertsPanel() {
  const [records, setRecords] = useState<SmsRecord[]>(MOCK_SMS);
  const [filterType, setFilterType] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composeMsg, setComposeMsg] = useState("");
  const [composeType, setComposeType] = useState<SmsRecord["alert_type"]>("PSPS");
  const [composeZip, setComposeZip] = useState("");

  const filtered = useMemo(() => {
    let list = [...records];
    if (filterType !== "All") list = list.filter((r) => r.alert_type === filterType);
    if (filterStatus !== "All") list = list.filter((r) => r.status === filterStatus.toLowerCase());
    return list.sort((a, b) => b.sent_at.getTime() - a.sent_at.getTime());
  }, [records, filterType, filterStatus]);

  const stats = useMemo(() => ({
    total:     records.length,
    delivered: records.filter((r) => ["delivered", "read", "replied"].includes(r.status)).length,
    helpFlags: records.filter((r) => r.reply_type === "HELP").length,
    deduped:   records.filter((r) => r.status === "deduped").length,
  }), [records]);

  const sendBroadcast = () => {
    if (!composeMsg.trim()) { toast.error("Message is required"); return; }
    const now = new Date();
    // Dedup check: did same ZIP receive same type alert in last 60 min?
    const recent = records.filter(
      (r) => r.zip_code === composeZip && r.alert_type === composeType &&
             (now.getTime() - r.sent_at.getTime()) < 3600000
    );
    const newId = `sms-${Date.now()}`;
    if (recent.length > 0) {
      setRecords((prev) => [{
        id: newId,
        customer_name: `Zone ${composeZip || "All"}`,
        zip_code: composeZip || "All",
        phone: "broadcast",
        message: composeMsg,
        status: "deduped" as Status,
        sent_at: now,
        alert_type: composeType,
      }, ...prev]);
      toast.warning("Alert deduped — this ZIP already received a recent alert of this type");
    } else {
      setRecords((prev) => [{
        id: newId,
        customer_name: `Zone ${composeZip || "All"}`,
        zip_code: composeZip || "All",
        phone: "broadcast",
        message: composeMsg,
        status: "sent" as Status,
        sent_at: now,
        alert_type: composeType,
      }, ...prev]);
      toast.success(`Broadcast sent to ZIP ${composeZip || "All"} customers`);
    }
    setComposeMsg("");
    setComposerOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Sent", val: stats.total, color: "text-white" },
          { label: "Delivered", val: stats.delivered, color: "text-emerald-400" },
          { label: "Help Flags", val: stats.helpFlags, color: "text-red-400" },
          { label: "Deduped", val: stats.deduped, color: "text-white/40" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {["All", "PSPS", "Fire", "Restoration", "Financial"].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                filterType === t
                  ? "bg-white/10 border-white/20 text-white"
                  : "bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/60"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {["All", "Replied", "Help", "Failed"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s === "Help" ? "replied" : s)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                (filterStatus === s || (s === "Help" && filterStatus === "replied"))
                  ? "bg-white/10 border-white/20 text-white"
                  : "bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/60"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => setComposerOpen(!composerOpen)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-medium hover:bg-blue-600/30 transition-colors"
        >
          <Send className="w-3 h-3" />
          Compose Broadcast
        </button>
      </div>

      {/* Composer */}
      {composerOpen && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-white/80">New Alert Broadcast</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Alert Type</label>
              <select
                value={composeType}
                onChange={(e) => setComposeType(e.target.value as SmsRecord["alert_type"])}
                className="w-full px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              >
                {["PSPS", "Fire", "Restoration", "Financial"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">ZIP Code (blank = all)</label>
              <input
                type="text"
                value={composeZip}
                onChange={(e) => setComposeZip(e.target.value)}
                placeholder="e.g. 95370"
                className="w-full px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
          </div>
          <textarea
            value={composeMsg}
            onChange={(e) => setComposeMsg(e.target.value)}
            placeholder="Message text… (include CONFIRM/HELP reply instructions)"
            rows={3}
            className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
          />
          <p className="text-[10px] text-white/30">
            Dedup window: 60 min per ZIP per alert type. Duplicate alerts are blocked automatically.
          </p>
          <div className="flex gap-2">
            <button
              onClick={sendBroadcast}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Send Now
            </button>
            <button
              onClick={() => setComposerOpen(false)}
              className="px-4 py-2 rounded-md bg-white/5 border border-white/10 text-white/50 text-sm hover:text-white/70 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* SMS log */}
      <div className="rounded-lg border border-white/[0.08] overflow-hidden">
        <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
          <span className="text-xs font-semibold text-white/60">Alert Log — {filtered.length} records</span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {filtered.map((r) => {
            const sc = STATUS_CONFIG[r.status];
            return (
              <div key={r.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white/90">{r.customer_name}</span>
                      <span className={`text-[10px] font-semibold ${ALERT_TYPE_COLORS[r.alert_type]}`}>
                        {r.alert_type}
                      </span>
                      <span className="text-[10px] text-white/25">{r.zip_code}</span>
                      {r.phone !== "broadcast" && (
                        <span className="text-[10px] text-white/20 font-mono">{r.phone}</span>
                      )}
                    </div>
                    <p className="text-xs text-white/40 mt-1 line-clamp-1">{r.message}</p>

                    {/* Reply thread */}
                    {r.reply && (
                      <div className="mt-2 ml-3 pl-3 border-l border-white/10">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-3 h-3 text-purple-400" />
                          <span className="text-xs text-white/60 italic">"{r.reply}"</span>
                          {r.reply_at && (
                            <span className="text-[9px] text-white/20">{formatRelative(r.reply_at)}</span>
                          )}
                        </div>
                        {r.reply_type && r.reply_type !== "CUSTOM" && (
                          <div className="mt-1 flex items-center gap-2">
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${REPLY_CONFIG[r.reply_type].badge}`}>
                              {r.reply_type}
                            </span>
                            <span className="text-[9px] text-white/30">{REPLY_CONFIG[r.reply_type].action}</span>
                          </div>
                        )}
                        {r.reply_type === "HELP" && (
                          <button
                            onClick={() => toast.success(`Escalating ${r.customer_name} to live agent`)}
                            className="mt-1.5 flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-600/20 border border-red-500/30 text-red-300 text-[9px] font-medium hover:bg-red-600/30 transition-colors"
                          >
                            <Phone className="w-2.5 h-2.5" />
                            Escalate to Agent
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Status + time */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${sc.badge}`}>
                      {sc.icon}
                      {sc.label}
                    </span>
                    <span className="text-[9px] text-white/20 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {formatRelative(r.sent_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-10 text-center text-white/30 text-sm">No alerts match the current filters</div>
          )}
        </div>
      </div>

      {/* Dedup explanation */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <div className="flex items-start gap-2">
          <Filter className="w-3.5 h-3.5 text-white/30 shrink-0 mt-0.5" />
          <p className="text-[10px] text-white/30 leading-relaxed">
            <span className="text-white/50 font-medium">Alert deduplication:</span> Customers receive at most 1 alert per
            type per 60-minute window. Blocked duplicates are logged as "Deduped" for audit purposes. Emergency
            escalations (HELP replies) bypass dedup and always reach an agent.
          </p>
        </div>
      </div>
    </div>
  );
}
