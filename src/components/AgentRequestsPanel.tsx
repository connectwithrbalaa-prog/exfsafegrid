import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Inbox, Clock, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CustomerRequest {
  id: string;
  customer_id: string;
  customer_name: string;
  request_type: string;
  details: Record<string, string>;
  status: string;
  agent_response: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  outage_report: "⚡ Outage Report",
  bill_inquiry: "💰 Bill Inquiry",
  assistance_application: "🤝 Assistance Application",
  demand_response: "🌿 Demand Response Enrollment",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-warning/20 text-warning border-warning/30",
  in_review: "bg-info/20 text-info border-info/30",
  resolved: "bg-success/20 text-success border-success/30",
};

export default function AgentRequestsPanel() {
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("customer_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setRequests(data as unknown as CustomerRequest[]);
      });

    // Realtime
    const channel = supabase
      .channel("requests-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "customer_requests" },
        (payload) => {
          const newReq = payload.new as unknown as CustomerRequest;
          setRequests((prev) => [newReq, ...prev]);
          toast.info(`New ${TYPE_LABELS[newReq.request_type] || "request"} from ${newReq.customer_name}`);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "customer_requests" },
        (payload) => {
          const updated = payload.new as unknown as CustomerRequest;
          setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleRespond = async (req: CustomerRequest) => {
    if (!responseText.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("customer_requests")
      .update({ status: "resolved", agent_response: responseText } as any)
      .eq("id", req.id as any);
    setSaving(false);
    if (error) {
      toast.error("Failed to save response");
    } else {
      toast.success(`Response sent to ${req.customer_name}`);
      setResponseText("");
      setExpanded(null);
    }
  };

  const markInReview = async (req: CustomerRequest) => {
    await supabase
      .from("customer_requests")
      .update({ status: "in_review" } as any)
      .eq("id", req.id as any);
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="p-5 rounded-lg border border-border bg-card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-card-foreground">Customer Requests</h3>
        </div>
        {pendingCount > 0 && (
          <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-warning/20 text-warning border border-warning/30">
            {pendingCount} pending
          </span>
        )}
      </div>

      {requests.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No customer requests yet</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {requests.map((req) => (
            <div key={req.id} className="rounded-md border border-border bg-background">
              <button
                onClick={() => {
                  setExpanded(expanded === req.id ? null : req.id);
                  if (req.status === "pending") markInReview(req);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left"
              >
                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${STATUS_COLORS[req.status] || ""}`}>
                  {req.status === "pending" ? "NEW" : req.status === "in_review" ? "REVIEWING" : "DONE"}
                </span>
                <span className="text-xs font-medium text-foreground truncate flex-1">
                  {TYPE_LABELS[req.request_type] || req.request_type} — {req.customer_name}
                </span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(req.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                {expanded === req.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {expanded === req.id && (
                <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                  <dl className="space-y-1">
                    {Object.entries(req.details).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <dt className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</dt>
                        <dd className="font-medium text-foreground max-w-[200px] text-right">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  {req.status === "resolved" && req.agent_response ? (
                    <div className="p-2 rounded-md bg-success/10 border border-success/20">
                      <p className="text-xs text-success flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Agent Response</p>
                      <p className="text-xs text-foreground mt-1">{req.agent_response}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        placeholder="Type your response to the customer..."
                        className="w-full h-16 px-2 py-1.5 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleRespond(req)}
                        disabled={saving || !responseText.trim()}
                        className="w-full text-xs"
                      >
                        {saving ? "Sending…" : "Send Response & Resolve"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
