import { useNavigate } from "react-router-dom";
import { Zap, ArrowLeft, BookOpen, Users, Shield, BarChart3, Layers, AlertTriangle, Target, Clock, Globe } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const sections = [
  {
    id: "executive-summary",
    icon: BookOpen,
    title: "Executive Summary",
    content: (
      <>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          <strong className="text-foreground">ExfSafeGrid</strong> is a unified wildfire-aware utility operations platform that connects three critical personas — <strong>Customers</strong>, <strong>Agents</strong>, and <strong>Executives</strong> — through a single, real-time data backbone. It replaces the fragmented tool landscape (outage trackers, billing portals, fire maps, PSPS spreadsheets) with one cohesive system that turns raw data into actionable decisions.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead><tr className="bg-muted/50"><th className="text-left p-2.5 font-semibold text-foreground">Persona</th><th className="text-left p-2.5 font-semibold text-foreground">Gets</th><th className="text-left p-2.5 font-semibold text-foreground">Instead of</th></tr></thead>
            <tbody className="text-muted-foreground">
              <tr className="border-t border-border"><td className="p-2.5 font-medium text-foreground">Customer</td><td className="p-2.5">Personalized risk dashboard + AI chatbot + self-service forms</td><td className="p-2.5">Generic portal + phone queue</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-medium text-foreground">Agent</td><td className="p-2.5">12-column unified workspace with AI co-pilot</td><td className="p-2.5">4+ separate tools + manual lookups</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-medium text-foreground">Executive</td><td className="p-2.5">Real-time command center with satellite fire data</td><td className="p-2.5">Delayed reports + disconnected maps</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-medium text-foreground">Community</td><td className="p-2.5">Automated proximity-based SMS/email alerts</td><td className="p-2.5">Manual phone trees + delayed notices</td></tr>
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "architecture",
    icon: Layers,
    title: "Platform Architecture",
    content: (
      <>
        <pre className="text-xs bg-muted/50 rounded-lg p-4 overflow-x-auto text-muted-foreground mb-4 border border-border">{`┌─────────────────────────────────────────────────────────┐
│                    ExfSafeGrid Platform                  │
├───────────────┬────────────────┬────────────────────────┤
│  Customer     │  Agent         │  Executive Command     │
│  Portal       │  Desktop       │  Center                │
│  (/)          │  (/)           │  (/command-center)     │
├───────────────┴────────────────┴────────────────────────┤
│                  Shared Services Layer                   │
│  • AI Chat (Gemini 2.5 Flash)  • NASA FIRMS Fire Data   │
│  • NWS Red Flag Warnings       • Open-Meteo Weather     │
│  • Mapbox Satellite Maps       • Realtime DB (Postgres) │
│  • Community Alert Engine      • Hazard Photo Storage   │
├─────────────────────────────────────────────────────────┤
│                   Lovable Cloud                          │
│  Edge Functions │ Postgres DB │ Realtime │ Storage      │
└─────────────────────────────────────────────────────────┘`}</pre>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead><tr className="bg-muted/50"><th className="text-left p-2.5 font-semibold text-foreground">Route</th><th className="text-left p-2.5 font-semibold text-foreground">Purpose</th><th className="text-left p-2.5 font-semibold text-foreground">Access</th></tr></thead>
            <tbody className="text-muted-foreground">
              <tr className="border-t border-border"><td className="p-2.5 font-mono text-xs">/login</td><td className="p-2.5">Customer/Agent authentication</td><td className="p-2.5">Public</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-mono text-xs">/</td><td className="p-2.5">Customer portal or Agent desktop (role-based)</td><td className="p-2.5">Authenticated</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-mono text-xs">/command-center</td><td className="p-2.5">Executive Command Center</td><td className="p-2.5">Agent/Executive</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-mono text-xs">/demo</td><td className="p-2.5">9-slide executive presentation deck</td><td className="p-2.5">Internal</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-mono text-xs">/docs</td><td className="p-2.5">This documentation page</td><td className="p-2.5">Public</td></tr>
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "customer-portal",
    icon: Users,
    title: "Customer Portal",
    content: (
      <>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">The customer view provides a personalized, non-technical experience focused on safety and self-service.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead><tr className="bg-muted/50"><th className="text-left p-2.5 font-semibold text-foreground">Feature</th><th className="text-left p-2.5 font-semibold text-foreground">Description</th></tr></thead>
            <tbody className="text-muted-foreground">
              {[
                ["Personalized Status Bar", "Outage status, PSPS phase, and restoration timer in plain language"],
                ["Risk Dashboard", "Wildfire Risk, Bill & Assistance, Grid Stress cards contextualized to ZIP and account"],
                ["Wildfire Proximity Map", "Mapbox satellite map with active fires, distance rings, and severity coding"],
                ["AI Chatbot", "Gemini 2.5 Flash assistant pre-loaded with full account context"],
                ["Self-Service Forms", "Report Outage, View Bill, Apply for Assistance, Demand Response Enrollment"],
                ["Active Alert Banner", "Contextual fire weather warnings"],
              ].map(([f, d]) => (
                <tr key={f} className="border-t border-border"><td className="p-2.5 font-medium text-foreground whitespace-nowrap">{f}</td><td className="p-2.5">{d}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "agent-desktop",
    icon: Shield,
    title: "Agent Desktop",
    content: (
      <>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">A 12-column grid layout (5-4-3) optimized for maximum information density during live call handling.</p>
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="left"><AccordionTrigger className="text-sm font-semibold">Left Column (5 cols) — Customer Profile</AccordionTrigger><AccordionContent>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-4">
              <li>Region-filtered customer selector with Red Flag priority ranking</li>
              <li>9-card detail grid: Name, ZIP, Region, Risk, HFTD Tier, Medical Baseline, Arrears, Grid Stress, Bill Trend</li>
              <li>Serving infrastructure card (substation, voltage, capacity)</li>
              <li>Persistent agent notes (DB synced)</li>
            </ul>
          </AccordionContent></AccordionItem>
          <AccordionItem value="middle"><AccordionTrigger className="text-sm font-semibold">Middle Column (4 cols) — Safety & Operations</AccordionTrigger><AccordionContent>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-4">
              <li>Medical Priority Badge with doorbell ring & priority restore actions</li>
              <li>5-phase PSPS Tracker with progress controls and ETR presets</li>
              <li>Backup Power tracking (portable, permanent, transfer meter)</li>
              <li>CRC capacity monitoring with ADA, WiFi, Water services</li>
              <li>4-button Quick Actions: Call, REACH, PSPS Alert, Add Note</li>
            </ul>
          </AccordionContent></AccordionItem>
          <AccordionItem value="right"><AccordionTrigger className="text-sm font-semibold">Right Column (3 cols) — AI & Requests</AccordionTrigger><AccordionContent>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-4">
              <li>AI Co-Pilot with utility policy knowledge and customer context</li>
              <li>Real-time customer requests feed with status management</li>
              <li>Hazard report submission with photo upload and geolocation</li>
            </ul>
          </AccordionContent></AccordionItem>
        </Accordion>
      </>
    ),
  },
  {
    id: "command-center",
    icon: Target,
    title: "Executive Command Center",
    content: (
      <>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">Situational awareness for utility leadership with 9 analytical tabs and 7 toggleable map overlays.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead><tr className="bg-muted/50"><th className="text-left p-2.5 font-semibold text-foreground">Tab</th><th className="text-left p-2.5 font-semibold text-foreground">Purpose</th></tr></thead>
            <tbody className="text-muted-foreground">
              {[
                ["Grid Asset Status", "Substations & transmission lines with risk level, trend, and recommended action"],
                ["HVRA Registry", "Hospitals, schools, water systems with importance weighting and proximity analysis"],
                ["NVC Risk Scores", "Net Value Change dashboard computing financial exposure"],
                ["Evacuation", "Route capacity analysis, bottleneck identification, clearance time estimates"],
                ["Resources", "Crew deployment, equipment allocation, resource availability"],
                ["Insurance Risk", "Property exposure analysis with premium impact modeling"],
                ["Fire History", "8 historical Sierra Nevada fires (2013–2022) correlated with current conditions"],
                ["Fire Behavior", "Rothermel-based spread rate, flame length, fireline intensity, spotting distance"],
                ["Community Alerts", "Subscriber management, proximity scanning, manual alert composer"],
              ].map(([t, p]) => (
                <tr key={t} className="border-t border-border"><td className="p-2.5 font-medium text-foreground whitespace-nowrap">{t}</td><td className="p-2.5">{p}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "pain-areas",
    icon: AlertTriangle,
    title: "Pain Areas & Solutions",
    content: (
      <div className="space-y-4">
        {[
          { pain: "Fragmented Agent Tools", before: "4–6 tools per call — billing, outage tracker, PSPS spreadsheet, fire map, CRM, safety protocols", after: "Single-screen 12-column workspace with everything visible simultaneously", impact: "40–60% AHT reduction during PSPS events" },
          { pain: "Delayed Risk Awareness", before: "Email-based fire reports with 30–60 min lag, manual correlation to grid assets", after: "Live NASA FIRMS satellite data overlaid on grid infrastructure with automatic risk scoring", impact: "Risk latency reduced from 30–60 min to <5 min" },
          { pain: "Customer Communication Gaps", before: "Generic outage pages, phone queues, no proactive fire notifications", after: "Personalized portal + AI chatbot + self-service forms", impact: "30–50% call volume reduction, 24/7 availability" },
          { pain: "Manual PSPS Tracking", before: "Spreadsheets, email chains, verbal patrolling estimates", after: "5-phase timeline with one-click transitions, live ETR, patrolling slider", impact: "50–70% coordination time reduction" },
          { pain: "No Community Alerting", before: "Manual phone trees, social media, county-level systems", after: "Automated proximity-based alerts with 3-tier severity for 12 ZIP zones", impact: "Hours → seconds notification delivery" },
          { pain: "No Integrated Risk Modeling", before: "Separate departments with no shared view", after: "Unified analytical tabs: Fire Behavior, Insurance, Evacuation, HVRA, NVC, History", impact: "3–5 departmental meetings → single dashboard" },
        ].map((item) => (
          <div key={item.pain} className="p-3 rounded-lg border border-border bg-muted/30">
            <h4 className="text-sm font-semibold text-foreground mb-2">{item.pain}</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div><span className="font-medium text-destructive">Before:</span> {item.before}</div>
              <div><span className="font-medium text-primary">After:</span> {item.after}</div>
              <div><span className="font-medium text-foreground">Impact:</span> {item.impact}</div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "unified-value",
    icon: Users,
    title: "Unified View: Value for Agents & Teams",
    content: (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="p-3 rounded-lg border border-border bg-muted/30">
            <h4 className="text-sm font-semibold text-destructive mb-2">Before ExfSafeGrid</h4>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li>Alt-Tab between 4+ tools per call</li>
              <li>12–18 min Average Handle Time (PSPS)</li>
              <li>~30% of call time spent searching for data</li>
            </ul>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/30">
            <h4 className="text-sm font-semibold text-primary mb-2">After ExfSafeGrid</h4>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li>Everything on one screen</li>
              <li>5–8 min Average Handle Time (PSPS)</li>
              <li>Near-zero context loss</li>
            </ul>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead><tr className="bg-muted/50"><th className="text-left p-2.5 font-semibold text-foreground">Capability</th><th className="text-left p-2.5 font-semibold text-foreground">Mechanism</th></tr></thead>
            <tbody className="text-muted-foreground">
              <tr className="border-t border-border"><td className="p-2.5 font-medium text-foreground">Shared customer state</td><td className="p-2.5">Realtime DB subscriptions broadcast updates to all agents</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-medium text-foreground">Consistent prioritization</td><td className="p-2.5">Red Flag Warning auto-ranks customers by risk</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-medium text-foreground">Seamless handoffs</td><td className="p-2.5">Agent notes persist in DB; any agent sees full history</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-medium text-foreground">Global PSPS visibility</td><td className="p-2.5">Any agent updating progress triggers global header update</td></tr>
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "quantitative",
    icon: BarChart3,
    title: "Quantitative Value — Production Projections",
    content: (
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-foreground">Call Volume Reduction</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead><tr className="bg-muted/50"><th className="text-left p-2.5 font-semibold text-foreground">Metric</th><th className="text-left p-2.5 font-semibold text-foreground">Current</th><th className="text-left p-2.5 font-semibold text-foreground">With ExfSafeGrid</th><th className="text-left p-2.5 font-semibold text-foreground">Savings</th></tr></thead>
            <tbody className="text-muted-foreground">
              <tr className="border-t border-border"><td className="p-2.5">Calls per PSPS event</td><td className="p-2.5">15,000–30,000</td><td className="p-2.5">7,500–15,000</td><td className="p-2.5 font-semibold text-primary">50% reduction</td></tr>
              <tr className="border-t border-border"><td className="p-2.5">Avg Handle Time</td><td className="p-2.5">14 min</td><td className="p-2.5">6 min</td><td className="p-2.5 font-semibold text-primary">57% reduction</td></tr>
              <tr className="border-t border-border"><td className="p-2.5">Agent hours per event</td><td className="p-2.5">3,500–7,000</td><td className="p-2.5">750–1,500</td><td className="p-2.5 font-semibold text-primary">~80% reduction</td></tr>
              <tr className="border-t border-border"><td className="p-2.5">Cost per event @ $8/call</td><td className="p-2.5">$120K–$240K</td><td className="p-2.5">$60K–$120K</td><td className="p-2.5 font-semibold text-primary">$60K–$120K saved</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground italic">Assuming 5–8 PSPS events per fire season: $300K–$960K annual savings from call reduction alone.</p>

        <h4 className="text-sm font-semibold text-foreground">Operational Efficiency</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead><tr className="bg-muted/50"><th className="text-left p-2.5 font-semibold text-foreground">Metric</th><th className="text-left p-2.5 font-semibold text-foreground">Current</th><th className="text-left p-2.5 font-semibold text-foreground">With ExfSafeGrid</th></tr></thead>
            <tbody className="text-muted-foreground">
              <tr className="border-t border-border"><td className="p-2.5">Risk awareness latency</td><td className="p-2.5">30–60 min</td><td className="p-2.5 font-semibold text-primary">&lt;5 min (90%+ faster)</td></tr>
              <tr className="border-t border-border"><td className="p-2.5">PSPS coordination meetings</td><td className="p-2.5">3–5 per event</td><td className="p-2.5 font-semibold text-primary">1 (60–80% fewer)</td></tr>
              <tr className="border-t border-border"><td className="p-2.5">Community notification time</td><td className="p-2.5">2–6 hours</td><td className="p-2.5 font-semibold text-primary">&lt;1 minute (99%+ faster)</td></tr>
              <tr className="border-t border-border"><td className="p-2.5">Agent context-switching</td><td className="p-2.5">4–6 tool switches/call</td><td className="p-2.5 font-semibold text-primary">0 (100% eliminated)</td></tr>
              <tr className="border-t border-border"><td className="p-2.5">Self-service rate</td><td className="p-2.5">~10%</td><td className="p-2.5 font-semibold text-primary">~50% (5× increase)</td></tr>
              <tr className="border-t border-border"><td className="p-2.5">First-call resolution</td><td className="p-2.5">~60%</td><td className="p-2.5 font-semibold text-primary">~85% (+25 points)</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    id: "qualitative",
    icon: Globe,
    title: "Qualitative Value",
    content: (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { title: "Utility Leadership", items: ["Single source of truth for wildfire risk exposure", "Audit-ready decision log — every action timestamped", "Regulatory compliance support (PSPS, medical baseline, notifications)", "Board-ready 9-slide executive demo deck at /demo"] },
          { title: "Field Operations", items: ["Hazard reporting with photo upload creates inspection pipeline", "CRC capacity monitoring prevents overcrowding", "Crew resource tracking across zones"] },
          { title: "Customer Trust", items: ["Transparency replaces opacity — actual risk, not generic advisories", "24/7 AI chatbot access to personalized information", "Self-service respects customers' time"] },
          { title: "Regulatory & PR", items: ["Community alert audit trail for fire events", "PSPS lifecycle documentation for systematic management", "Medical baseline tracking proves compliance"] },
        ].map((group) => (
          <div key={group.title} className="p-3 rounded-lg border border-border bg-muted/30">
            <h4 className="text-sm font-semibold text-foreground mb-2">{group.title}</h4>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              {group.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "roadmap",
    icon: Clock,
    title: "Roadmap & Next Steps",
    content: (
      <div className="space-y-4">
        {[
          { phase: "Immediate (Next Sprint)", items: [["SMS/Email delivery", "Twilio + SendGrid for actual alert delivery"], ["Smoke dispersion model", "Estimated smoke coverage visualization"], ["PSPS decision support", "Automated de-energization zone recommendations"]] },
          { phase: "Near-Term (1–2 Months)", items: [["Mobile-responsive redesign", "Mobile-first customer portal"], ["Push notifications", "Browser/PWA push for real-time alerts"], ["Advanced auth", "Role-based access control"], ["Automated PSPS triggers", "Rules-based phase transitions from weather + fire data"]] },
          { phase: "Medium-Term (3–6 Months)", items: [["GIS integration", "Actual utility circuit maps and vegetation zones"], ["ML fire prediction", "24–72h risk forecasting from historical data"], ["Multi-utility support", "White-label deployment"], ["API gateway", "REST API for OMS, CIS, GIS integration"]] },
        ].map((phase) => (
          <div key={phase.phase}>
            <h4 className="text-sm font-semibold text-foreground mb-2">{phase.phase}</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                <tbody className="text-muted-foreground">
                  {phase.items.map(([item, desc]) => (
                    <tr key={item} className="border-t border-border first:border-t-0"><td className="p-2.5 font-medium text-foreground whitespace-nowrap">{item}</td><td className="p-2.5">{desc}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    ),
  },
];

const Documentation = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                <span className="text-exf-blue">Exf</span><span className="text-exf-red">Safe</span><span className="text-exf-blue">Grid</span>
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">Docs</span>
            </div>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:block">MVP v1.0 — February 2026</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
          {/* Sidebar nav */}
          <nav className="hidden lg:block">
            <div className="sticky top-20">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contents</h3>
              <ul className="space-y-1">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1.5 px-2 rounded-md hover:bg-muted/50"
                    >
                      <s.icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{s.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          {/* Main content */}
          <main className="space-y-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">ExfSafeGrid MVP Documentation</h1>
              <p className="text-sm text-muted-foreground">Complete product documentation covering features, architecture, pain areas, value propositions, and roadmap.</p>
            </div>

            {sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-20">
                <div className="flex items-center gap-2 mb-4">
                  <section.icon className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
                </div>
                {section.content}
              </section>
            ))}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Documentation;
