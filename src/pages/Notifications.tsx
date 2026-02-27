/**
 * Notifications — Dedicated page for exec/comms roles.
 * Lists templates grouped by type, preview window, send-test & schedule-send.
 */
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import TopNav from "@/components/TopNav";
import NotificationAnalyticsDashboard from "@/components/NotificationAnalyticsDashboard";
import { toast } from "sonner";
import {
  Bell, Radio, ShieldAlert, Zap, RotateCcw, Eye, Send, Clock,
  MessageSquare, Mail, Phone, Loader2, CheckCircle2, Calendar,
  ChevronRight, X
} from "lucide-react";

/* ── Types ── */

interface Template {
  id: string;
  type: string;
  name: string;
  body: string;
  channels: string[];
  variables?: string[];
}

interface Customer {
  id: string;
  name: string;
  zip_code: string;
  medical_baseline: boolean;
}

/* ── Config ── */

const TYPE_META: Record<string, { icon: typeof Bell; label: string; color: string; bg: string }> = {
  watch:       { icon: Radio,       label: "Watch",       color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
  warning:     { icon: ShieldAlert, label: "Warning",     color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20" },
  shutoff:     { icon: Zap,         label: "Shutoff",     color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20" },
  restoration: { icon: RotateCcw,   label: "Restoration", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
};

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  sms: MessageSquare,
  email: Mail,
  voice: Phone,
};

type Tab = "templates" | "analytics";

export default function Notifications() {
  const [tab, setTab] = useState<Tab>("templates");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [channel, setChannel] = useState("sms");
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("08:00");

  /* ── Data loading ── */
  useEffect(() => {
    (async () => {
      setLoadingTemplates(true);
      const { data } = await supabase.functions.invoke("notifications-templates");
      setTemplates(data?.templates ?? []);
      setLoadingTemplates(false);
    })();
    (async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, name, zip_code, medical_baseline")
        .order("name")
        .limit(200);
      setCustomers((data as Customer[]) ?? []);
    })();
  }, []);

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  /* Group templates by type */
  const grouped = useMemo(() => {
    const map: Record<string, Template[]> = {};
    templates.forEach((t) => {
      (map[t.type] ??= []).push(t);
    });
    return Object.entries(map);
  }, [templates]);

  /* ── Actions ── */

  const handlePreview = async () => {
    if (!selectedId) return;
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("notifications-preview", {
        body: { template_id: selectedId, channel },
      });
      if (error) throw error;
      setPreview(data);
    } catch (e: any) {
      toast.error("Preview failed: " + e.message);
    }
    setPreviewLoading(false);
  };

  const handleSendTest = async () => {
    if (!selectedId || !selectedCustomers.length) {
      toast.error("Select a template and at least one recipient");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("notifications-send", {
        body: { customer_ids: selectedCustomers, template_id: selectedId, channel },
      });
      if (error) throw error;
      toast.success(`${data.sent_count} test notification(s) sent`);
      setSelectedCustomers([]);
    } catch (e: any) {
      toast.error("Send failed: " + e.message);
    }
    setSending(false);
  };

  const handleSchedule = () => {
    if (!scheduleDate) { toast.error("Pick a date"); return; }
    toast.success(`Scheduled for ${scheduleDate} at ${scheduleTime} (mock — will be sent then)`);
    setScheduleOpen(false);
  };

  const toggleCustomer = (id: string) =>
    setSelectedCustomers((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-[hsl(220,25%,6%)] text-white">
      <TopNav variant="dark" />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Notifications</h1>
              <p className="text-xs text-white/40">Compose, preview & send customer notifications</p>
            </div>
          </div>

          {/* Tab toggle */}
          <div className="flex gap-1 bg-white/[0.03] border border-white/[0.08] rounded-lg p-1">
            {([["templates", "Templates", Bell], ["analytics", "Analytics", ChevronRight]] as const).map(([k, label, Icon]) => (
              <button
                key={k}
                onClick={() => setTab(k as Tab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  tab === k ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "analytics" ? (
          <NotificationAnalyticsDashboard />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
            {/* ── Left: Template List ── */}
            <div className="space-y-4">
              {loadingTemplates ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 rounded-lg bg-white/[0.03] animate-pulse" />
                  ))}
                </div>
              ) : (
                grouped.map(([type, items]) => {
                  const meta = TYPE_META[type] ?? TYPE_META.watch;
                  const TypeIcon = meta.icon;
                  return (
                    <div key={type}>
                      <div className="flex items-center gap-2 mb-2">
                        <TypeIcon className={`w-3.5 h-3.5 ${meta.color}`} />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                          {meta.label}
                        </span>
                        <span className="text-[10px] text-white/20">{items.length}</span>
                      </div>
                      <div className="space-y-1.5">
                        {items.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => { setSelectedId(t.id); setPreview(null); }}
                            className={`w-full text-left px-3 py-3 rounded-lg border transition-all ${
                              selectedId === t.id
                                ? `${meta.bg} shadow-sm`
                                : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                            }`}
                          >
                            <p className="text-xs font-medium text-white/90">{t.name}</p>
                            <p className="text-[11px] text-white/35 mt-0.5 line-clamp-2">{t.body}</p>
                            <div className="flex gap-1.5 mt-2">
                              {t.channels.map((ch) => {
                                const ChIcon = CHANNEL_ICONS[ch] ?? Mail;
                                return (
                                  <span key={ch} className="flex items-center gap-1 text-[9px] text-white/25">
                                    <ChIcon className="w-2.5 h-2.5" /> {ch.toUpperCase()}
                                  </span>
                                );
                              })}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ── Right: Preview + Actions ── */}
            <div className="space-y-4">
              {!selected ? (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-center py-24">
                  <div className="text-center text-white/20">
                    <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Select a template to preview</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Channel + Preview controls */}
                  <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">{selected.name}</h3>
                      <div className="flex gap-1.5">
                        {["sms", "email", "voice"].map((ch) => {
                          const ChIcon = CHANNEL_ICONS[ch];
                          const avail = selected.channels.includes(ch);
                          return (
                            <button
                              key={ch}
                              onClick={() => { setChannel(ch); setPreview(null); }}
                              disabled={!avail}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-colors ${
                                channel === ch
                                  ? "bg-blue-600/20 border-blue-500/30 text-blue-300"
                                  : avail
                                    ? "border-white/[0.08] text-white/40 hover:text-white/60"
                                    : "border-white/[0.04] text-white/15 cursor-not-allowed"
                              }`}
                            >
                              <ChIcon className="w-3 h-3" /> {ch.toUpperCase()}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      onClick={handlePreview}
                      disabled={previewLoading}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs font-medium hover:text-white/80 transition-colors disabled:opacity-40"
                    >
                      {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                      Generate Preview
                    </button>

                    {/* Preview output */}
                    {preview && (
                      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 space-y-2">
                        <p className="text-[10px] text-white/30 uppercase tracking-wider">
                          {preview.channel?.toUpperCase()} Preview
                        </p>
                        {preview.subject && (
                          <p className="text-xs text-white/60"><strong>Subject:</strong> {preview.subject}</p>
                        )}
                        {preview.html_body ? (
                          <div
                            className="text-xs rounded-md overflow-hidden border border-white/10"
                            dangerouslySetInnerHTML={{ __html: preview.html_body }}
                          />
                        ) : (
                          <p className="text-sm bg-white/[0.03] p-3 rounded-md font-mono text-xs text-white/80">
                            {preview.rendered_text}
                          </p>
                        )}
                        {preview.estimated_duration_seconds && (
                          <p className="text-[10px] text-white/30">
                            Est. voice duration: {preview.estimated_duration_seconds}s
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Recipients */}
                  <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-white/70">Recipients</h4>
                      <button
                        onClick={() =>
                          setSelectedCustomers(
                            selectedCustomers.length === customers.length ? [] : customers.map((c) => c.id)
                          )
                        }
                        className="text-[10px] text-white/30 hover:text-white/50"
                      >
                        {selectedCustomers.length === customers.length ? "Deselect all" : "Select all"}
                      </button>
                    </div>
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-white/[0.06] divide-y divide-white/[0.04]">
                      {customers.slice(0, 50).map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.02] transition-colors cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCustomers.includes(c.id)}
                            onChange={() => toggleCustomer(c.id)}
                            className="rounded border-white/20"
                          />
                          <span className="text-xs text-white/80 flex-1">{c.name}</span>
                          <span className="text-[10px] text-white/25">{c.zip_code}</span>
                          {c.medical_baseline && (
                            <span className="text-[9px] bg-red-500/15 text-red-300 px-1.5 py-0.5 rounded-full">MBL</span>
                          )}
                        </label>
                      ))}
                    </div>
                    {selectedCustomers.length > 0 && (
                      <p className="text-[10px] text-blue-300">{selectedCustomers.length} recipient(s) selected</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={handleSendTest}
                      disabled={sending || !selectedCustomers.length}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Send Test
                    </button>

                    <button
                      onClick={() => setScheduleOpen(!scheduleOpen)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-sm font-medium hover:text-white/80 transition-colors"
                    >
                      <Calendar className="w-4 h-4" />
                      Schedule Send
                    </button>

                    <span className="text-[10px] text-white/20 ml-auto">Mock delivery — no real SMS/email sent</span>
                  </div>

                  {/* Schedule picker */}
                  {scheduleOpen && (
                    <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-white/70 flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          Schedule Delivery
                        </h4>
                        <button onClick={() => setScheduleOpen(false)} className="text-white/30 hover:text-white/50">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                        />
                        <input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                        />
                        <button
                          onClick={handleSchedule}
                          disabled={!scheduleDate || !selectedCustomers.length}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600/80 text-white text-xs font-medium hover:bg-amber-500 transition-colors disabled:opacity-30"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Confirm Schedule
                        </button>
                      </div>
                      <p className="text-[10px] text-white/25">
                        {selectedCustomers.length} recipient(s) · {selected.name} · {channel.toUpperCase()}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
