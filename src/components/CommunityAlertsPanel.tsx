import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Bell, Send, Users, AlertTriangle, ShieldAlert, Plus, X, Mail, Phone,
  CheckCircle, Clock, ChevronDown, ChevronUp, Megaphone,
} from "lucide-react";
import type { FirePoint } from "@/lib/wildfire-utils";
import { toast } from "sonner";
import { subscriberSchema, manualAlertSchema } from "@/lib/validation";

interface AlertSubscriber {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  zip_code: string;
  preferred_channel: string;
  is_active: boolean;
  created_at: string;
}

interface CommunityAlert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  affected_zips: string[];
  fire_distance_km: number | null;
  recipients_count: number;
  delivery_status: string;
  created_at: string;
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  critical: { bg: "bg-red-500/15 border-red-500/30", text: "text-red-300", icon: "🔴" },
  high: { bg: "bg-orange-500/15 border-orange-500/30", text: "text-orange-300", icon: "🟠" },
  warning: { bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-300", icon: "🟡" },
  info: { bg: "bg-blue-500/15 border-blue-500/30", text: "text-blue-300", icon: "🔵" },
};

const SERVICE_ZIPS = ["93644", "93614", "93623", "93210", "93242", "93230", "93637", "93602", "93604", "93654", "93667", "93651"];

export default function CommunityAlertsPanel({ fires }: { fires: FirePoint[] }) {
  const [subscribers, setSubscribers] = useState<AlertSubscriber[]>([]);
  const [alerts, setAlerts] = useState<CommunityAlert[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showManualAlert, setShowManualAlert] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  // Add subscriber form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newZip, setNewZip] = useState(SERVICE_ZIPS[0]);
  const [newChannel, setNewChannel] = useState("email");

  // Manual alert form
  const [manualMsg, setManualMsg] = useState("");
  const [manualZips, setManualZips] = useState<string[]>([]);
  const [manualSeverity, setManualSeverity] = useState("warning");

  const fetchData = useCallback(async () => {
    const [{ data: subs }, { data: als }] = await Promise.all([
      supabase.from("alert_subscribers").select("*").order("created_at", { ascending: false }),
      supabase.from("community_alerts").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    if (subs) setSubscribers(subs as unknown as AlertSubscriber[]);
    if (als) setAlerts(als as unknown as CommunityAlert[]);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addSubscriber = async () => {
    const parsed = subscriberSchema.safeParse({
      name: newName,
      email: newEmail,
      phone: newPhone,
      zip_code: newZip,
      preferred_channel: newChannel,
    });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || "Invalid input");
      return;
    }
    const { error } = await supabase.from("alert_subscribers").insert({
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      zip_code: parsed.data.zip_code,
      preferred_channel: parsed.data.preferred_channel,
    });
    if (error) { toast.error("Failed to add subscriber"); return; }
    toast.success("Subscriber added");
    setNewName(""); setNewEmail(""); setNewPhone("");
    setShowAddForm(false);
    fetchData();
  };

  const toggleSubscriber = async (id: string, isActive: boolean) => {
    await supabase.from("alert_subscribers").update({ is_active: !isActive }).eq("id", id);
    fetchData();
  };

  const removeSubscriber = async (id: string) => {
    await supabase.from("alert_subscribers").delete().eq("id", id);
    fetchData();
  };

  const runProximityScan = async () => {
    if (fires.length === 0) { toast.error("No fire data available"); return; }
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("community-alerts", {
        body: { fires },
      });
      if (error) throw error;
      toast.success(`Scan complete — ${data?.total || 0} alerts generated`);
      fetchData();
    } catch (e: any) {
      toast.error("Proximity scan failed");
      console.error(e);
    } finally {
      setScanning(false);
    }
  };

  const sendManualAlert = async () => {
    const parsed = manualAlertSchema.safeParse({
      message: manualMsg,
      zips: manualZips,
      severity: manualSeverity,
    });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || "Invalid input");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("community-alerts", {
        body: { manual: true, manualMessage: manualMsg, manualZips, manualSeverity },
      });
      if (error) throw error;
      toast.success(`Alert sent to ${data?.recipients || 0} subscribers`);
      setManualMsg(""); setManualZips([]); setShowManualAlert(false);
      fetchData();
    } catch (e: any) {
      toast.error("Failed to send alert");
    }
  };

  const toggleZip = (zip: string) => {
    setManualZips((prev) => prev.includes(zip) ? prev.filter((z) => z !== zip) : [...prev, zip]);
  };

  const totalActive = subscribers.filter((s) => s.is_active).length;
  const emailSubs = subscribers.filter((s) => s.preferred_channel === "email" && s.is_active).length;
  const smsSubs = subscribers.filter((s) => s.preferred_channel === "sms" && s.is_active).length;
  const recentCritical = alerts.filter((a) => a.severity === "critical").length;

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-[10px] uppercase tracking-wider text-white/40">Total Subscribers</span>
          </div>
          <span className="text-2xl font-bold text-white/90">{totalActive}</span>
          <div className="flex gap-3 mt-1 text-[10px] text-white/30">
            <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {emailSubs} email</span>
            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {smsSubs} SMS</span>
          </div>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] uppercase tracking-wider text-white/40">Alerts Sent</span>
          </div>
          <span className="text-2xl font-bold text-white/90">{alerts.length}</span>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span className="text-[10px] uppercase tracking-wider text-white/40">Critical Alerts</span>
          </div>
          <span className={`text-2xl font-bold ${recentCritical > 0 ? "text-red-400" : "text-white/90"}`}>{recentCritical}</span>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] uppercase tracking-wider text-white/40">ZIP Zones</span>
          </div>
          <span className="text-2xl font-bold text-white/90">{SERVICE_ZIPS.length}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={runProximityScan}
          disabled={scanning || fires.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 transition-colors disabled:opacity-30"
        >
          <AlertTriangle className={`w-3.5 h-3.5 ${scanning ? "animate-pulse" : ""}`} />
          {scanning ? "Scanning…" : "Run Proximity Scan"}
        </button>
        <button
          onClick={() => setShowManualAlert(!showManualAlert)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-colors"
        >
          <Megaphone className="w-3.5 h-3.5" />
          Manual Alert
        </button>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-500/15 border border-blue-500/30 text-blue-300 hover:bg-blue-500/25 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Subscriber
        </button>
      </div>

      {/* Manual Alert Form */}
      {showManualAlert && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
              <Megaphone className="w-4 h-4" /> Send Manual Alert
            </h3>
            <button onClick={() => setShowManualAlert(false)} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
          </div>
          <textarea
            value={manualMsg}
            onChange={(e) => setManualMsg(e.target.value)}
            placeholder="Alert message for residents…"
            rows={3}
            className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
          />
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Severity</label>
            <div className="flex gap-2">
              {["critical", "high", "warning", "info"].map((s) => (
                <button
                  key={s}
                  onClick={() => setManualSeverity(s)}
                  className={`px-2.5 py-1 rounded text-[10px] font-medium border transition-colors ${
                    manualSeverity === s
                      ? `${SEVERITY_STYLES[s].bg} ${SEVERITY_STYLES[s].text}`
                      : "bg-white/[0.03] border-white/[0.08] text-white/30"
                  }`}
                >
                  {SEVERITY_STYLES[s].icon} {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Target ZIP Codes</label>
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_ZIPS.map((zip) => (
                <button
                  key={zip}
                  onClick={() => toggleZip(zip)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                    manualZips.includes(zip)
                      ? "bg-amber-500/20 border-amber-500/30 text-amber-200"
                      : "bg-white/[0.03] border-white/[0.08] text-white/30 hover:text-white/50"
                  }`}
                >
                  {zip}
                </button>
              ))}
              <button
                onClick={() => setManualZips(manualZips.length === SERVICE_ZIPS.length ? [] : [...SERVICE_ZIPS])}
                className="px-2 py-0.5 rounded text-[11px] border bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/60"
              >
                {manualZips.length === SERVICE_ZIPS.length ? "Clear All" : "Select All"}
              </button>
            </div>
          </div>
          <button
            onClick={sendManualAlert}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 transition-colors"
          >
            <Send className="w-3.5 h-3.5" /> Send Alert
          </button>
        </div>
      )}

      {/* Add Subscriber Form */}
      {showAddForm && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-blue-300 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Subscriber
            </h3>
            <button onClick={() => setShowAddForm(false)} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" className="bg-black/30 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/40" />
            <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email" className="bg-black/30 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/40" />
            <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Phone" className="bg-black/30 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/40" />
            <select value={newZip} onChange={(e) => setNewZip(e.target.value)} className="bg-black/30 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white/90 focus:outline-none focus:ring-1 focus:ring-blue-500/40">
              {SERVICE_ZIPS.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-[10px] uppercase tracking-wider text-white/40">Channel:</label>
            {["email", "sms", "both"].map((ch) => (
              <button
                key={ch}
                onClick={() => setNewChannel(ch)}
                className={`px-2.5 py-1 rounded text-[10px] font-medium border transition-colors ${
                  newChannel === ch ? "bg-blue-500/20 border-blue-500/30 text-blue-200" : "bg-white/[0.03] border-white/[0.08] text-white/30"
                }`}
              >
                {ch === "email" ? "📧 Email" : ch === "sms" ? "📱 SMS" : "📧📱 Both"}
              </button>
            ))}
            <button onClick={addSubscriber} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-500/20 border border-blue-500/40 text-blue-200 hover:bg-blue-500/30 transition-colors">
              <CheckCircle className="w-3.5 h-3.5" /> Save
            </button>
          </div>
        </div>
      )}

      {/* Two-Column Layout: Subscribers + Alert History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Subscribers */}
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold">Subscribers ({subscribers.length})</span>
          </div>
          <div className="max-h-[320px] overflow-y-auto divide-y divide-white/[0.04]">
            {subscribers.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-white/20">No subscribers yet. Add residents to receive alerts.</div>
            ) : subscribers.map((s) => (
              <div key={s.id} className={`px-4 py-2.5 flex items-center justify-between ${!s.is_active ? "opacity-40" : ""}`}>
                <div>
                  <div className="text-sm font-medium text-white/80">{s.name}</div>
                  <div className="text-[10px] text-white/30 flex items-center gap-2 mt-0.5">
                    <span className="font-mono">{s.zip_code}</span>
                    {s.email && <span>📧 {s.email}</span>}
                    {s.phone && <span>📱 {s.phone}</span>}
                    <span className="uppercase">{s.preferred_channel}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleSubscriber(s.id, s.is_active)}
                    className={`px-2 py-0.5 rounded text-[9px] font-medium border transition-colors ${
                      s.is_active ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "bg-white/[0.03] border-white/[0.08] text-white/30"
                    }`}
                  >
                    {s.is_active ? "Active" : "Paused"}
                  </button>
                  <button onClick={() => removeSubscriber(s.id)} className="text-white/15 hover:text-red-400 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alert History */}
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold">Alert History ({alerts.length})</span>
          </div>
          <div className="max-h-[320px] overflow-y-auto divide-y divide-white/[0.04]">
            {alerts.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-white/20">No alerts sent yet. Run a proximity scan to generate alerts.</div>
            ) : alerts.map((a) => {
              const sev = SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.info;
              const expanded = expandedAlert === a.id;
              return (
                <div key={a.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedAlert(expanded ? null : a.id)}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${sev.bg} ${sev.text}`}>
                        {sev.icon} {a.severity.toUpperCase()}
                      </span>
                      <span className="text-xs text-white/70 truncate">{a.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-white/20">{new Date(a.created_at).toLocaleDateString()}</span>
                      {expanded ? <ChevronUp className="w-3 h-3 text-white/20" /> : <ChevronDown className="w-3 h-3 text-white/20" />}
                    </div>
                  </div>
                  {expanded && (
                    <div className="mt-2 pl-2 border-l-2 border-white/[0.06] space-y-1">
                      <p className="text-xs text-white/50 leading-relaxed">{a.message}</p>
                      <div className="flex gap-3 text-[10px] text-white/30">
                        <span>📍 ZIPs: {a.affected_zips?.join(", ") || "—"}</span>
                        <span>👥 {a.recipients_count} recipients</span>
                        {a.fire_distance_km && <span>🔥 {Math.round(a.fire_distance_km * 0.621371)} mi</span>}
                        <span className="flex items-center gap-1">
                          {a.delivery_status === "delivered" ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Clock className="w-3 h-3 text-amber-400" />}
                          {a.delivery_status}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
