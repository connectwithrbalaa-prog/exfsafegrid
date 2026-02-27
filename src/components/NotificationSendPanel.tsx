/**
 * NotificationSendPanel — Agent-facing notification composer.
 * Fetches templates, allows preview, and sends to selected customers.
 * Writes to customer_notifications via the notifications-send edge function.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, Eye, CheckCircle2, AlertTriangle, Loader2, Users, Mail, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";

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
  psps_phase: string;
}

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  sms: MessageSquare,
  email: Mail,
  voice: Phone,
};

export default function NotificationSendPanel() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [channel, setChannel] = useState<string>("sms");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [filterZip, setFilterZip] = useState("");
  const [filterMedical, setFilterMedical] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [sent, setSent] = useState<{ count: number; at: Date } | null>(null);

  // Load templates
  useEffect(() => {
    const load = async () => {
      setLoadingTemplates(true);
      try {
        const { data, error } = await supabase.functions.invoke("notifications-templates");
        if (error) throw error;
        setTemplates(data.templates ?? []);
        if (data.templates?.length) setSelectedTemplate(data.templates[0].id);
      } catch (e: any) {
        console.error("Failed to load templates:", e);
        toast.error("Failed to load notification templates");
      }
      setLoadingTemplates(false);
    };
    load();
  }, []);

  // Load customers
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, name, zip_code, medical_baseline, psps_phase")
        .order("name");
      setCustomers((data as Customer[]) ?? []);
    };
    load();
  }, []);

  const filtered = customers.filter((c) => {
    if (filterZip && !c.zip_code.includes(filterZip)) return false;
    if (filterMedical && !c.medical_baseline) return false;
    return true;
  });

  const activeTemplate = templates.find((t) => t.id === selectedTemplate);

  const handlePreview = async () => {
    if (!selectedTemplate) return;
    try {
      const { data, error } = await supabase.functions.invoke("notifications-preview", {
        body: { template_id: selectedTemplate, channel },
      });
      if (error) throw error;
      setPreview(data);
    } catch (e: any) {
      toast.error("Preview failed: " + e.message);
    }
  };

  const handleSend = async () => {
    if (!selectedCustomers.length) {
      toast.error("Select at least one customer");
      return;
    }
    if (!selectedTemplate) {
      toast.error("Select a template");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("notifications-send", {
        body: {
          customer_ids: selectedCustomers,
          template_id: selectedTemplate,
          channel,
        },
      });
      if (error) throw error;
      setSent({ count: data.sent_count, at: new Date() });
      setSelectedCustomers([]);
      toast.success(`${data.sent_count} notification(s) sent (${data.delivery_mode} mode)`);
    } catch (e: any) {
      toast.error("Send failed: " + e.message);
    }
    setSending(false);
  };

  const toggleAll = () => {
    if (selectedCustomers.length === filtered.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(filtered.map((c) => c.id));
    }
  };

  const toggleCustomer = (id: string) => {
    setSelectedCustomers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-5">
      {/* Template & Channel Selection */}
      <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] p-5">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Send className="w-4 h-4 text-blue-400" />
          Send Notification
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Template */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">Template</label>
            {loadingTemplates ? (
              <div className="flex items-center gap-2 text-white/30 text-sm py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
              </div>
            ) : (
              <select
                value={selectedTemplate}
                onChange={(e) => { setSelectedTemplate(e.target.value); setPreview(null); }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            {activeTemplate && (
              <p className="text-[11px] text-white/30 mt-1.5 line-clamp-2">{activeTemplate.body}</p>
            )}
          </div>

          {/* Channel */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">Channel</label>
            <div className="flex gap-2">
              {["sms", "email", "voice"].map((ch) => {
                const Icon = CHANNEL_ICONS[ch];
                const available = activeTemplate?.channels?.includes(ch) ?? true;
                return (
                  <button
                    key={ch}
                    onClick={() => { setChannel(ch); setPreview(null); }}
                    disabled={!available}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      channel === ch
                        ? "bg-blue-600/20 border-blue-500/30 text-blue-300"
                        : available
                        ? "bg-white/[0.03] border-white/[0.08] text-white/50 hover:text-white/70"
                        : "bg-white/[0.01] border-white/[0.04] text-white/15 cursor-not-allowed"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {ch.toUpperCase()}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handlePreview}
              disabled={!selectedTemplate}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-white/50 text-xs hover:text-white/70 transition-colors disabled:opacity-30"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
          </div>
        </div>

        {/* Preview */}
        {preview && (
          <div className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Preview — {preview.channel?.toUpperCase()}</p>
            {preview.subject && (
              <p className="text-xs text-white/60 mb-1"><strong>Subject:</strong> {preview.subject}</p>
            )}
            {preview.html_body ? (
              <div
                className="text-xs rounded-md overflow-hidden border border-white/10"
                dangerouslySetInnerHTML={{ __html: preview.html_body }}
              />
            ) : (
              <p className="text-sm text-white/80 bg-white/[0.03] p-3 rounded-md font-mono text-xs">
                {preview.rendered_text}
              </p>
            )}
            {preview.estimated_duration_seconds && (
              <p className="text-[10px] text-white/30 mt-2">
                Est. voice duration: {preview.estimated_duration_seconds}s
              </p>
            )}
          </div>
        )}
      </div>

      {/* Customer Selection */}
      <div className="rounded-xl border border-white/[0.08] bg-[hsl(220,25%,9%)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            Recipients
            {selectedCustomers.length > 0 && (
              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                {selectedCustomers.length} selected
              </span>
            )}
          </h3>
          <button onClick={toggleAll} className="text-[10px] text-white/40 hover:text-white/60 transition-colors">
            {selectedCustomers.length === filtered.length ? "Deselect All" : "Select All"}
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-3">
          <input
            type="text"
            value={filterZip}
            onChange={(e) => setFilterZip(e.target.value)}
            placeholder="Filter by ZIP…"
            className="px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/50 w-32"
          />
          <label className="flex items-center gap-1.5 text-xs text-white/50 cursor-pointer">
            <input
              type="checkbox"
              checked={filterMedical}
              onChange={(e) => setFilterMedical(e.target.checked)}
              className="rounded border-white/20"
            />
            Medical Baseline only
          </label>
          <span className="text-[10px] text-white/25 ml-auto">{filtered.length} customers</span>
        </div>

        {/* Customer list */}
        <div className="max-h-48 overflow-y-auto rounded-lg border border-white/[0.06] divide-y divide-white/[0.04]">
          {filtered.slice(0, 50).map((c) => (
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
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                c.psps_phase === "Restored" ? "bg-emerald-500/15 text-emerald-300" :
                c.psps_phase === "Shutoff" ? "bg-red-500/15 text-red-300" :
                "bg-amber-500/15 text-amber-300"
              }`}>{c.psps_phase}</span>
            </label>
          ))}
          {filtered.length === 0 && (
            <div className="py-6 text-center text-white/30 text-xs">No customers match filters</div>
          )}
        </div>
      </div>

      {/* Send */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSend}
          disabled={sending || !selectedCustomers.length || !selectedTemplate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send to {selectedCustomers.length} Customer{selectedCustomers.length !== 1 ? "s" : ""}
        </button>

        {sent && (
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {sent.count} sent at {sent.at.toLocaleTimeString()}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-white/25">
          <AlertTriangle className="w-3 h-3" />
          Mock delivery mode — no real SMS/email sent
        </div>
      </div>
    </div>
  );
}
