import { useNavigate } from "react-router-dom";
import { Zap, ArrowLeft, BookOpen, Users, Shield, BarChart3, Layers, AlertTriangle, Target, Clock, Globe, Bot, Map, Wrench, Bell, Brain } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import TopNav from "@/components/TopNav";

const sections = [
  {
    id: "executive-summary",
    icon: BookOpen,
    title: "Executive Summary",
    content: (
      <>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          <strong className="text-foreground">ExfSafeGrid</strong> is a unified wildfire-aware utility operations platform that connects four critical personas — <strong>Customers</strong>, <strong>Agents</strong>, <strong>Field Crews</strong>, and <strong>Executives</strong> — through a single, real-time data backbone. It replaces the fragmented tool landscape (outage trackers, billing portals, fire maps, PSPS spreadsheets) with one cohesive system that turns raw data into actionable decisions.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead><tr className="bg-muted/50"><th className="text-left p-2.5 font-semibold text-foreground">Persona</th><th className="text-left p-2.5 font-semibold text-foreground">Gets</th><th className="text-left p-2.5 font-semibold text-foreground">Instead of</th></tr></thead>
            <tbody className="text-muted-foreground">
              <tr className="border-t border-border"><td className="p-2.5 font-medium text-foreground">Customer</td><td className="p-2.5">Personalized risk dashboard + SafetyGuard AI + self-service forms</td><td className="p-2.5">Generic portal + phone queue</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-medium text-foreground">Agent</td><td className="p-2.5">12-column unified workspace with RiskAdvisor AI co-pilot</td><td className="p-2.5">4+ separate tools + manual lookups</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-medium text-foreground">Field Crew</td><td className="p-2.5">Mobile patrol app with live map, task management + FireSight AI + push alerts</td><td className="p-2.5">Paper checklists + radio dispatches</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-medium text-foreground">Executive</td><td className="p-2.5">Multi-workspace command center with GridOracle AI + PSPS Simulator</td><td className="p-2.5">Delayed reports + disconnected maps</td></tr>
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
        <pre className="text-xs bg-muted/50 rounded-lg p-4 overflow-x-auto text-muted-foreground mb-4 border border-border">{`┌──────────────────────────────────────────────────────────────┐
│                     ExfSafeGrid Platform                     │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Customer    │  Agent       │  Field Crew  │  Executive     │
│  Portal      │  Desktop     │  App         │  Command Ctr   │
│  /customer   │  /agent      │  /field-crew │  /command-ctr  │
├──────────────┴──────────────┴──────────────┴────────────────┤
│                   Shared Services Layer                      │
│  • Persona AI Assistants     • NASA FIRMS Fire Data          │
│  • ML Predictions (FastAPI)  • NWS Red Flag Warnings         │
│  • Mapbox Satellite Maps     • Open-Meteo Weather            │
│  • Community Alert Engine    • Hazard Photo Storage           │
├──────────────────────────────────────────────────────────────┤
│  Lovable Cloud (Supabase)   │  FastAPI Backend               │
│  Edge Functions │ Postgres   │  ML Models │ Data Ingestion   │
│  Realtime │ Auth │ Storage   │  Agents │ Predictions API     │
└──────────────────────────────────────────────────────────────┘`}</pre>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead><tr className="bg-muted/50"><th className="text-left p-2.5 font-semibold text-foreground">Route</th><th className="text-left p-2.5 font-semibold text-foreground">Purpose</th><th className="text-left p-2.5 font-semibold text-foreground">Access</th></tr></thead>
            <tbody className="text-muted-foreground">
              <tr className="border-t border-border"><td className="p-2.5 font-mono text-xs">/</td><td className="p-2.5">Role Chooser — persona selection landing page</td><td className="p-2.5">Public</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-mono text-xs">/login?role=…</td><td className="p-2.5">Role-locked authentication</td><td className="p-2.5">Public</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-mono text-xs">/customer</td><td className="p-2.5">Customer portal with safety dashboard</td><td className="p-2.5">Customer</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-mono text-xs">/agent</td><td className="p-2.5">Agent desktop workspace</td><td className="p-2.5">Agent</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-mono text-xs">/field-crew</td><td className="p-2.5">Field crew mobile patrol app</td><td className="p-2.5">Field</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-mono text-xs">/command-center/*</td><td className="p-2.5">Executive Command Center (4 workspaces)</td><td className="p-2.5">Executive</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-mono text-xs">/psps-simulator</td><td className="p-2.5">PSPS de-energization impact simulator</td><td className="p-2.5">Executive</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-mono text-xs">/playbooks</td><td className="p-2.5">Saved PSPS scenario library</td><td className="p-2.5">Executive</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-mono text-xs">/replay</td><td className="p-2.5">Historical PSPS event replay & comparison</td><td className="p-2.5">Executive</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-mono text-xs">/docs</td><td className="p-2.5">This documentation page</td><td className="p-2.5">Executive</td></tr>
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
                ["SafetyGuard AI", "Persona-tuned AI assistant with non-technical language, pre-loaded with account context"],
                ["Self-Service Forms", "Report Outage, View Bill, Apply for Assistance, Demand Response Enrollment"],
                ["Active Alert Banner", "Contextual fire weather warnings"],
                ["Programs Eligibility", "Medical baseline, hardship, and demand response program status"],
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
              <li>Tabbed Risk / Support / Map views</li>
            </ul>
          </AccordionContent></AccordionItem>
          <AccordionItem value="right"><AccordionTrigger className="text-sm font-semibold">Right Column (3 cols) — AI & Requests</AccordionTrigger><AccordionContent>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-4">
              <li>Tabbed chat: Agent Assist (general) + RiskAdvisor AI (ML-powered predictions)</li>
              <li>Real-time customer requests feed with status management</li>
              <li>Hazard report submission with photo upload and geolocation</li>
              <li>Risk forecast panel with circuit ignition data</li>
            </ul>
          </AccordionContent></AccordionItem>
        </Accordion>
      </>
    ),
  },
  {
    id: "field-crew",
    icon: Map,
    title: "Field Crew App",
    content: (
      <>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">Mobile-first patrol application for field crews with real-time situational awareness, task management, and push notification alerts.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead><tr className="bg-muted/50"><th className="text-left p-2.5 font-semibold text-foreground">Tab</th><th className="text-left p-2.5 font-semibold text-foreground">Features</th></tr></thead>
            <tbody className="text-muted-foreground">
              {[
                ["Tasks", "Patrol task list from DB with status tracking (NOT_STARTED → IN_PROGRESS → COMPLETED), priority badges, circuit assignment"],
                ["Map", "Satellite Mapbox view centered on patrol area with task markers, HVRA asset overlay, patrol route visualization, live safety strip (wind, humidity, nearest fire distance, risk band)"],
                ["Reports", "Patrol completion reports, hazard documentation, and shift summaries"],
                ["FireSight AI", "Persona-tuned ML assistant for field-specific queries: priority patrolling, fire spread predictions, ignition risk forecasts"],
              ].map(([f, d]) => (
                <tr key={f} className="border-t border-border"><td className="p-2.5 font-medium text-foreground whitespace-nowrap">{f}</td><td className="p-2.5">{d}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 p-3 rounded-lg border border-border bg-muted/30">
          <h4 className="text-sm font-semibold text-foreground mb-2">Push Notification Alerts</h4>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li>Automatic alerts when risk band escalates to HIGH or CRITICAL</li>
            <li>Three-layer notification: in-app toast, native browser push, and haptic vibration</li>
            <li>Distinct severity patterns: CRITICAL (15s persistent toast, triple vibration) vs HIGH (8s toast, double vibration)</li>
            <li>Escalation-only triggers — alerts fire only on transitions (e.g., MEDIUM → HIGH), not on sustained levels</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    id: "command-center",
    icon: Target,
    title: "Executive Command Center",
    content: (
      <>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">Multi-workspace command center with four specialized views for utility leadership situational awareness and decision support.</p>
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="executive"><AccordionTrigger className="text-sm font-semibold">Executive Workspace — KPIs & Strategic Overview</AccordionTrigger><AccordionContent>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-4">
              <li>KPI cards: Circuits Monitored, High/Critical Circuits, PSAs Elevated, PSPS Simulator link</li>
              <li>Quick links to Playbooks and Historical Replay</li>
              <li>Top 5 Rising Risk card with trend analysis</li>
              <li>PSA Activity Risk summary (Top 10) with probability and risk buckets</li>
              <li>GridOracle AI — strategic risk intelligence chat</li>
              <li>Backend Ops panel for model training, scoring, and ingestion control</li>
            </ul>
          </AccordionContent></AccordionItem>
          <AccordionItem value="wildfire"><AccordionTrigger className="text-sm font-semibold">Wildfire Workspace — Operational Monitoring</AccordionTrigger><AccordionContent>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-4">
              <li>Grid Asset Status — substations & transmission lines with risk, trend, and recommended actions</li>
              <li>HVRA Registry — hospitals, schools, water systems with importance weighting</li>
              <li>NVC Risk Scores — Net Value Change financial exposure dashboard</li>
              <li>Evacuation — route capacity, bottleneck identification, clearance estimates</li>
              <li>Resources — crew deployment, equipment allocation</li>
              <li>Insurance Risk — property exposure with premium impact modeling</li>
              <li>Fire History — 8 Sierra Nevada fires (2013–2022) correlated with current conditions</li>
              <li>Fire Behavior — Rothermel-based spread rate, flame length, spotting distance</li>
              <li>Community Alerts — subscriber management, proximity scanning, alert composer</li>
            </ul>
          </AccordionContent></AccordionItem>
          <AccordionItem value="gis"><AccordionTrigger className="text-sm font-semibold">GIS Workspace — Geospatial Analysis</AccordionTrigger><AccordionContent>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-4">
              <li>Interactive Mapbox map with toggleable layers: Evacuation, Weather, Spread, Ignition</li>
              <li>Multiple map styles: Satellite, Streets, Dark</li>
              <li>Substations and transmission line overlays</li>
              <li>Active fire markers from NASA FIRMS data</li>
              <li>Asset risk computation based on fire proximity</li>
              <li>CSV export of asset risk assessments</li>
            </ul>
          </AccordionContent></AccordionItem>
          <AccordionItem value="planning"><AccordionTrigger className="text-sm font-semibold">Planning Workspace — Asset Strategy & Compliance</AccordionTrigger><AccordionContent>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-4">
              <li>Circuit Risk List — ignition risk table with CSV export</li>
              <li>Vegetation Risk Panel — vegetation management analysis</li>
              <li>Insurance Risk Panel — ZIP-level composite risk scoring</li>
              <li>Risk Threshold Settings — configurable risk band boundaries</li>
              <li>Compliance Dashboard — regulatory compliance tracking</li>
              <li>Notification Send Panel — manual notification dispatch</li>
              <li>Notification Analytics — delivery metrics and engagement tracking</li>
            </ul>
          </AccordionContent></AccordionItem>
        </Accordion>
      </>
    ),
  },
  {
    id: "ai-assistants",
    icon: Bot,
    title: "Persona AI Assistants",
    content: (
      <>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">Each persona has a dedicated ML-powered AI assistant with persona-specific system prompts, terminology, and tool access. All assistants can query live backend prediction models.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead><tr className="bg-muted/50"><th className="text-left p-2.5 font-semibold text-foreground">Assistant</th><th className="text-left p-2.5 font-semibold text-foreground">Persona</th><th className="text-left p-2.5 font-semibold text-foreground">Capabilities</th></tr></thead>
            <tbody className="text-muted-foreground">
              {[
                ["SafetyGuard", "Customer", "Non-technical language, avoids circuit IDs, focuses on safety steps and outage preparedness"],
                ["RiskAdvisor", "Agent", "Risk intelligence for customer-facing decisions, circuit density queries, medical baseline lookups"],
                ["GridOracle", "Executive", "Strategic risk forecasting, PSA analysis, grid intelligence, fire spread summaries"],
                ["FireSight", "Field Crew", "Priority patrolling guidance, fire spread predictions, ignition risk by area"],
              ].map(([name, persona, caps]) => (
                <tr key={name} className="border-t border-border"><td className="p-2.5 font-medium text-foreground">{name}</td><td className="p-2.5">{persona}</td><td className="p-2.5">{caps}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 p-3 rounded-lg border border-border bg-muted/30">
          <h4 className="text-sm font-semibold text-foreground mb-2">Tool Access</h4>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li><strong>query_circuit_ignition_risk</strong> — Circuit-level ignition spike predictions (24h/48h/72h)</li>
            <li><strong>query_psa_risk</strong> — PSA wildfire activity risk predictions (1–3 month horizon)</li>
            <li><strong>query_customer_density</strong> — Customer density per circuit with risk overlay</li>
            <li><strong>query_fire_spread_risk</strong> — Fire spread and behavior predictions</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    id: "ml-backend",
    icon: Brain,
    title: "ML Models & Backend",
    content: (
      <>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">A FastAPI backend powers ML predictions, AI agent operations, and live data ingestion from national fire and weather sources.</p>
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="models"><AccordionTrigger className="text-sm font-semibold">ML Models</AccordionTrigger><AccordionContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                <thead><tr className="bg-muted/50"><th className="text-left p-2.5 font-semibold text-foreground">Model</th><th className="text-left p-2.5 font-semibold text-foreground">Horizon</th><th className="text-left p-2.5 font-semibold text-foreground">Output</th></tr></thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-t border-border"><td className="p-2.5 font-medium text-foreground">PSA Risk</td><td className="p-2.5">1–3 months</td><td className="p-2.5">Probability of above-normal fire activity per PSA zone</td></tr>
                  <tr className="border-t border-border"><td className="p-2.5 font-medium text-foreground">Ignition Spike</td><td className="p-2.5">24h / 48h / 72h</td><td className="p-2.5">Circuit-level ignition spike probability with risk band</td></tr>
                  <tr className="border-t border-border"><td className="p-2.5 font-medium text-foreground">Fire Spread</td><td className="p-2.5">Real-time</td><td className="p-2.5">Rothermel-based spread rate, flame length, spotting distance</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Risk bands: LOW (&lt;30%), MEDIUM (30–50%), HIGH (50–75%), CRITICAL (&gt;75%)</p>
          </AccordionContent></AccordionItem>
          <AccordionItem value="agents"><AccordionTrigger className="text-sm font-semibold">AI Agent Operations</AccordionTrigger><AccordionContent>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-4">
              <li><strong>Ops Briefing Agent</strong> — Generates daily operations briefings with risk summaries, weather outlook, and action items</li>
              <li><strong>PSPS Planning Agent</strong> — Produces PSPS watchlists with 24h/48h/72h horizons, recommending circuits for de-energization</li>
              <li>Both agents are triggerable via Backend Ops panel or API</li>
            </ul>
          </AccordionContent></AccordionItem>
          <AccordionItem value="ingestion"><AccordionTrigger className="text-sm font-semibold">Data Ingestion Pipeline</AccordionTrigger><AccordionContent>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-4">
              <li><strong>NIFC Active Incidents</strong> — Wildfire incident data from National Interagency Fire Center</li>
              <li><strong>NIFC Perimeters</strong> — Fire boundary/perimeter snapshots</li>
              <li><strong>NIFC PSA Outlooks</strong> — 7-day and monthly fire potential forecasts by PSA zone</li>
              <li><strong>RAWS Stations</strong> — Remote Automated Weather Station observations</li>
              <li>Scheduled ingestion with manual trigger available via Backend Ops</li>
            </ul>
          </AccordionContent></AccordionItem>
        </Accordion>
      </>
    ),
  },
  {
    id: "psps-tools",
    icon: Zap,
    title: "PSPS Management Tools",
    content: (
      <>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">Comprehensive Public Safety Power Shutoff planning, simulation, and analysis tools.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead><tr className="bg-muted/50"><th className="text-left p-2.5 font-semibold text-foreground">Tool</th><th className="text-left p-2.5 font-semibold text-foreground">Description</th></tr></thead>
            <tbody className="text-muted-foreground">
              {[
                ["PSPS Simulator", "Model de-energization impact: customer counts (residential, commercial, critical), MW loss, restoration hours"],
                ["Playbooks", "Save and reload PSPS scenario configurations with circuit selections and baseline metrics"],
                ["Historical Replay", "Re-simulate past PSPS events using current models with AI-powered comparison summaries"],
                ["PSPS Watchlist", "AI-generated watchlist of circuits approaching PSPS thresholds (24h/48h/72h horizons)"],
                ["5-Phase Tracker", "Agent-facing lifecycle: Monitoring → Watch → Warning → Active → Restoration"],
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
    id: "pain-areas",
    icon: AlertTriangle,
    title: "Pain Areas & Solutions",
    content: (
      <div className="space-y-4">
        {[
          { pain: "Fragmented Agent Tools", before: "4–6 tools per call — billing, outage tracker, PSPS spreadsheet, fire map, CRM, safety protocols", after: "Single-screen 12-column workspace with RiskAdvisor AI co-pilot", impact: "40–60% AHT reduction during PSPS events" },
          { pain: "Delayed Risk Awareness", before: "Email-based fire reports with 30–60 min lag, manual correlation to grid assets", after: "Live NASA FIRMS satellite data overlaid on grid infrastructure with ML risk scoring", impact: "Risk latency reduced from 30–60 min to <5 min" },
          { pain: "Customer Communication Gaps", before: "Generic outage pages, phone queues, no proactive fire notifications", after: "Personalized portal + SafetyGuard AI + self-service forms", impact: "30–50% call volume reduction, 24/7 availability" },
          { pain: "Manual PSPS Tracking", before: "Spreadsheets, email chains, verbal patrolling estimates", after: "5-phase timeline with one-click transitions, live ETR, patrolling slider, simulator", impact: "50–70% coordination time reduction" },
          { pain: "No Community Alerting", before: "Manual phone trees, social media, county-level systems", after: "Automated proximity-based alerts with 3-tier severity for 12 ZIP zones", impact: "Hours → seconds notification delivery" },
          { pain: "No Integrated Risk Modeling", before: "Separate departments with no shared view", after: "Unified ML predictions, 4-workspace command center, AI agents for briefings & planning", impact: "3–5 departmental meetings → single dashboard" },
          { pain: "Disconnected Field Operations", before: "Paper checklists, radio-only communication, no live risk data in the field", after: "Mobile patrol app with live map, task DB, push alerts on risk escalation, FireSight AI", impact: "Real-time situational awareness for field crews" },
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
              <li>Field crews on paper checklists with no risk context</li>
            </ul>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/30">
            <h4 className="text-sm font-semibold text-primary mb-2">After ExfSafeGrid</h4>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li>Everything on one screen per persona</li>
              <li>5–8 min Average Handle Time (PSPS)</li>
              <li>Near-zero context loss with AI co-pilots</li>
              <li>Field crews with live map, push alerts, and ML predictions</li>
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
              <tr className="border-t border-border"><td className="p-2.5 font-medium text-foreground">ML-powered decisions</td><td className="p-2.5">All personas access the same prediction models via persona-tuned AI assistants</td></tr>
              <tr className="border-t border-border"><td className="p-2.5 font-medium text-foreground">Field ↔ Office sync</td><td className="p-2.5">Patrol tasks in DB, real-time status updates visible to command center</td></tr>
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
              <tr className="border-t border-border"><td className="p-2.5">Field crew risk visibility</td><td className="p-2.5">Radio updates only</td><td className="p-2.5 font-semibold text-primary">Real-time map + push alerts</td></tr>
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
          { title: "Utility Leadership", items: ["Single source of truth for wildfire risk exposure", "Audit-ready decision log — every action timestamped", "Regulatory compliance support (PSPS, medical baseline, notifications)", "PSPS Simulator + Playbooks for proactive scenario planning", "AI-generated daily ops briefings and PSPS watchlists"] },
          { title: "Field Operations", items: ["Mobile patrol app with live satellite map and task tracking", "Push notification alerts on risk escalation (HIGH/CRITICAL)", "FireSight AI for field-specific intelligence queries", "Hazard reporting with photo upload creates inspection pipeline", "CRC capacity monitoring prevents overcrowding"] },
          { title: "Customer Trust", items: ["Transparency replaces opacity — actual risk, not generic advisories", "24/7 SafetyGuard AI chatbot with personalized account context", "Self-service respects customers' time", "Programs eligibility visibility (medical baseline, hardship, demand response)"] },
          { title: "Regulatory & PR", items: ["Community alert audit trail for fire events", "PSPS lifecycle documentation for systematic management", "Medical baseline tracking proves compliance", "Historical replay capability for post-event analysis", "Notification analytics for delivery verification"] },
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
        <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 mb-4">
          <h4 className="text-sm font-semibold text-primary mb-2">✅ Recently Completed</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-xs text-muted-foreground">
            {[
              "Role-based access control (4 personas)",
              "ML fire prediction (PSA Risk + Ignition Spike)",
              "GIS workspace with Mapbox layers",
              "Push notifications for field risk alerts",
              "Field Crew mobile patrol app",
              "PSPS Simulator, Playbooks, & Replay",
              "Persona AI Assistants (4 models)",
              "Backend Ops panel (train, score, ingest)",
              "Daily Briefings & PSPS Watchlists (AI agents)",
              "Notification analytics dashboard",
            ].map((item) => (
              <div key={item} className="flex items-center gap-1.5 py-0.5">
                <span className="text-primary">✓</span> {item}
              </div>
            ))}
          </div>
        </div>
        {[
          { phase: "Immediate (Next Sprint)", items: [["SMS/Email delivery", "Twilio + SendGrid integration for actual alert delivery"], ["Smoke dispersion model", "Estimated smoke coverage visualization overlay"], ["Automated PSPS triggers", "Rules-based phase transitions from weather + fire data"]] },
          { phase: "Near-Term (1–2 Months)", items: [["Mobile-responsive redesign", "Mobile-first customer portal optimized for touch"], ["Multi-channel notifications", "SMS, email, and push notification orchestration"], ["Circuit risk trend charts", "Historical risk trend visualization per circuit"]] },
          { phase: "Medium-Term (3–6 Months)", items: [["Multi-utility support", "White-label deployment for additional utilities"], ["API gateway", "REST API for OMS, CIS, GIS system integration"], ["Advanced fire spread ML", "Neural network-based 24–72h fire behavior prediction"], ["Regulatory report generation", "Automated CPUC compliance report creation"]] },
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
      <TopNav />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
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
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">ExfSafeGrid Platform Documentation</h1>
              <p className="text-sm text-muted-foreground">Complete product documentation covering all four personas, AI assistants, ML models, PSPS tools, and roadmap.</p>
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
