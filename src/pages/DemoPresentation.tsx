import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Maximize, Minimize, ArrowLeft,
  Flame, Shield, Zap, Radio, BarChart3, Target, Users, TrendingUp,
  AlertTriangle, Activity, MapPin, Eye,
} from "lucide-react";

/* ── Slide data ─────────────────────────────────────────────── */

interface Slide {
  id: string;
  section?: string;
  content: React.ReactNode;
}

/* ── Scaled slide wrapper ───────────────────────────────────── */

function ScaledSlide({ children, containerRef }: { children: React.ReactNode; containerRef: React.RefObject<HTMLDivElement> }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      setScale(Math.min(w / 1920, h / 1080));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [containerRef]);

  return (
    <div
      style={{
        position: "absolute",
        width: 1920,
        height: 1080,
        left: "50%",
        top: "50%",
        marginLeft: -960,
        marginTop: -540,
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      {children}
    </div>
  );
}

/* ── Individual slides ──────────────────────────────────────── */

function TitleSlide() {
  return (
    <div className="w-full h-full flex flex-col justify-center items-center bg-gradient-to-br from-[hsl(220,30%,8%)] via-[hsl(220,25%,12%)] to-[hsl(220,20%,6%)] text-white px-40 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-orange-500/5 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-3xl" />
      <div className="absolute top-20 right-32 flex items-center gap-3 opacity-30">
        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
        <span className="text-sm font-mono tracking-wider">LIVE SATELLITE FEED</span>
      </div>

      <div className="flex items-center gap-6 mb-12">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-2xl shadow-orange-500/20">
          <Flame className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-[82px] font-extrabold tracking-tight leading-none">Exafluence</h1>
          <p className="text-[28px] text-white/50 font-medium tracking-wide">WILDFIRE INTELLIGENCE PLATFORM</p>
        </div>
      </div>
      <div className="w-32 h-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full mb-12" />
      <p className="text-[36px] text-white/70 font-light text-center max-w-[1200px] leading-relaxed">
        Asset-Aware Wildfire Intelligence for Utility Grid Protection
      </p>
      <div className="absolute bottom-16 flex items-center gap-8 text-white/30 text-[18px]">
        <span className="flex items-center gap-2"><Radio className="w-5 h-5" /> NASA FIRMS</span>
        <span className="w-1 h-1 rounded-full bg-white/30" />
        <span className="flex items-center gap-2"><Shield className="w-5 h-5" /> Real-Time Risk</span>
        <span className="w-1 h-1 rounded-full bg-white/30" />
        <span className="flex items-center gap-2"><Zap className="w-5 h-5" /> Grid Protection</span>
      </div>
    </div>
  );
}

function ProblemSlide() {
  return (
    <div className="w-full h-full flex bg-[hsl(220,30%,8%)] text-white">
      <div className="flex-1 flex flex-col justify-center px-32 pr-16">
        <p className="text-[20px] font-bold text-orange-400 uppercase tracking-widest mb-6">The Challenge</p>
        <h2 className="text-[64px] font-extrabold leading-[1.05] mb-10">
          Wildfire risk isn't a <span className="text-orange-400">data</span> problem —<br />
          it's a <span className="text-red-400">decision</span> problem.
        </h2>
        <p className="text-[28px] text-white/60 leading-relaxed max-w-[800px]">
          Thousands of satellite detections arrive daily, but only a handful actually threaten your grid infrastructure.
        </p>
      </div>
      <div className="w-[650px] flex flex-col justify-center items-center gap-8 pr-24">
        <StatBlock number="5,000+" label="Daily satellite detections" color="text-orange-400" />
        <StatBlock number="< 2%" label="Actually threaten grid assets" color="text-red-400" />
        <StatBlock number="Minutes" label="Window for operational decisions" color="text-amber-300" />
      </div>
    </div>
  );
}

function WhatWeDoSlide() {
  return (
    <div className="w-full h-full flex flex-col justify-center bg-[hsl(220,30%,8%)] text-white px-32">
      <p className="text-[20px] font-bold text-blue-400 uppercase tracking-widest mb-6">What We Do</p>
      <h2 className="text-[56px] font-extrabold leading-tight mb-14">
        Real-time NASA wildfire data,<br />
        mapped to <span className="text-blue-400">your infrastructure</span>.
      </h2>
      <div className="grid grid-cols-3 gap-10">
        <FeatureCard
          icon={<Radio className="w-10 h-10" />}
          title="Ingest"
          desc="NASA FIRMS VIIRS NOAA-20 satellite detections refreshed every pass — within hours of ignition."
          color="from-blue-500/20 to-blue-600/5"
          borderColor="border-blue-500/30"
        />
        <FeatureCard
          icon={<MapPin className="w-10 h-10" />}
          title="Correlate"
          desc="Each fire is mapped against substations, transmission lines, and their operational risk zones (5/10/30 km)."
          color="from-orange-500/20 to-orange-600/5"
          borderColor="border-orange-500/30"
        />
        <FeatureCard
          icon={<AlertTriangle className="w-10 h-10" />}
          title="Prioritize"
          desc="Only fires that pose real asset risk surface to operations — ranked by distance, intensity, and trajectory."
          color="from-red-500/20 to-red-600/5"
          borderColor="border-red-500/30"
        />
      </div>
    </div>
  );
}

function LiveMapSlide() {
  return (
    <div className="w-full h-full flex flex-col justify-center bg-[hsl(220,30%,8%)] text-white px-32">
      <p className="text-[20px] font-bold text-emerald-400 uppercase tracking-widest mb-6">Live Demo</p>
      <h2 className="text-[52px] font-extrabold leading-tight mb-8">
        Assets overlaid with active fires,<br />
        risk zones, and <span className="text-emerald-400">proximity intelligence</span>.
      </h2>
      <div className="flex-1 max-h-[600px] rounded-2xl border-2 border-white/10 bg-[hsl(220,25%,12%)] flex items-center justify-center relative overflow-hidden">
        {/* Map placeholder with visual elements */}
        <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 60% 40%, rgba(239,68,68,0.3), transparent 50%), radial-gradient(circle at 30% 60%, rgba(59,130,246,0.3), transparent 40%)" }} />
        <div className="text-center z-10">
          <Eye className="w-16 h-16 text-white/30 mx-auto mb-6" />
          <p className="text-[32px] font-bold text-white/60 mb-3">Interactive Satellite Map</p>
          <p className="text-[22px] text-white/40">Switch to the Command Center for the live view →</p>
          <div className="flex items-center justify-center gap-8 mt-8 text-[18px]">
            <span className="flex items-center gap-2 text-red-400"><span className="w-3 h-3 rounded-full bg-red-500" /> Wildfires</span>
            <span className="flex items-center gap-2 text-blue-400"><span className="w-3 h-3 rounded-full bg-blue-500" /> Substations</span>
            <span className="flex items-center gap-2 text-cyan-400"><span className="w-2 h-4 bg-cyan-400/60 rounded" /> Transmission</span>
            <span className="flex items-center gap-2 text-yellow-400/60"><span className="w-3 h-3 rounded-full border-2 border-yellow-400/40 border-dashed" /> Risk Zones</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DifferentiatorSlide() {
  return (
    <div className="w-full h-full flex bg-[hsl(220,30%,8%)] text-white">
      <div className="flex-1 flex flex-col justify-center px-32 pr-16">
        <p className="text-[20px] font-bold text-amber-400 uppercase tracking-widest mb-6">The Differentiator</p>
        <h2 className="text-[56px] font-extrabold leading-tight mb-10">
          We don't just show fires.<br />
          We show <span className="text-amber-400">which ones matter</span>.
        </h2>
        <div className="space-y-8">
          <DiffRow icon={<TrendingUp className="w-7 h-7 text-red-400" />} title="Approaching Fire Detection" desc="Track fire trajectory relative to assets — flag fires moving toward critical infrastructure." />
          <DiffRow icon={<Activity className="w-7 h-7 text-orange-400" />} title="Intensity Assessment" desc="Fire Radiative Power (FRP) analysis identifies high-energy fires that pose structural risk." />
          <DiffRow icon={<Target className="w-7 h-7 text-amber-400" />} title="Asset-Level Flagging" desc="Every substation and transmission line gets a risk level, trend, and recommended action." />
        </div>
      </div>
      <div className="w-[550px] flex flex-col justify-center items-center pr-20">
        <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-8 space-y-6">
          <p className="text-[16px] font-bold text-white/40 uppercase tracking-widest">Risk Levels</p>
          <RiskRow color="bg-red-500" label="Critical" desc="≤ 5 km · High FRP" />
          <RiskRow color="bg-orange-500" label="High" desc="≤ 10 km · Approaching" />
          <RiskRow color="bg-yellow-500" label="Medium" desc="≤ 30 km · Monitoring" />
          <RiskRow color="bg-emerald-500" label="Low" desc="> 30 km · Stable" />
        </div>
      </div>
    </div>
  );
}

function BusinessValueSlide() {
  return (
    <div className="w-full h-full flex flex-col justify-center bg-[hsl(220,30%,8%)] text-white px-32">
      <p className="text-[20px] font-bold text-emerald-400 uppercase tracking-widest mb-6">Business Value</p>
      <h2 className="text-[56px] font-extrabold leading-tight mb-16">
        Proactive response. Reduced liability.<br />
        <span className="text-emerald-400">Operational readiness.</span>
      </h2>
      <div className="grid grid-cols-3 gap-10">
        <ValueCard icon={<Shield className="w-12 h-12" />} title="Reduced Wildfire Liability" desc="Early detection and documented response protocols protect against regulatory and legal exposure." color="text-emerald-400" />
        <ValueCard icon={<Zap className="w-12 h-12" />} title="Faster PSPS Decisions" desc="Asset-aware intelligence enables precise, defensible shutoff decisions — reducing unnecessary outages." color="text-blue-400" />
        <ValueCard icon={<BarChart3 className="w-12 h-12" />} title="Single Executive View" desc="Leadership sees what matters: threatened assets, recommended actions, and grid status — not raw data." color="text-amber-400" />
      </div>
    </div>
  );
}

function CapabilitiesSlide() {
  return (
    <div className="w-full h-full flex flex-col justify-center bg-[hsl(220,30%,8%)] text-white px-32">
      <p className="text-[20px] font-bold text-violet-400 uppercase tracking-widest mb-6">Platform Capabilities</p>
      <h2 className="text-[52px] font-extrabold leading-tight mb-14">
        Why this is <span className="text-violet-400">powerful</span>.
      </h2>
      <div className="grid grid-cols-2 gap-x-16 gap-y-8">
        <CapRow icon="🛰️" title="Asset-Aware Wildfire Intelligence" desc="Fires correlated to substations & transmission lines in real-time" />
        <CapRow icon="📈" title="Predictive Risk Assessment" desc="Approaching fire detection with trajectory analysis" />
        <CapRow icon="🎯" title="Executive Command Center" desc="Grid status, asset table, and satellite map in one view" />
        <CapRow icon="⚡" title="PSPS Operations Support" desc="Phase tracking, ETR management, medical baseline prioritization" />
        <CapRow icon="🤖" title="AI-Powered Agent Assistant" desc="Context-aware chat for customer service and operations" />
        <CapRow icon="📊" title="Customer Self-Service Portal" desc="Personalized risk dashboards reduce inbound call volume" />
      </div>
    </div>
  );
}

function AudienceSlide() {
  return (
    <div className="w-full h-full flex flex-col justify-center bg-[hsl(220,30%,8%)] text-white px-32">
      <p className="text-[20px] font-bold text-cyan-400 uppercase tracking-widest mb-6">Who This Resonates With</p>
      <h2 className="text-[52px] font-extrabold leading-tight mb-14">
        Built for <span className="text-cyan-400">utility leadership</span>.
      </h2>
      <div className="grid grid-cols-3 gap-10">
        <AudienceCard title="CIO / COO" items={["Technology modernization", "Data-driven operations", "Single pane of glass"]} icon={<Users className="w-10 h-10" />} />
        <AudienceCard title="Grid Operations" items={["Real-time situational awareness", "PSPS decision support", "Field crew coordination"]} icon={<Activity className="w-10 h-10" />} />
        <AudienceCard title="Risk & Compliance" items={["Wildfire liability reduction", "Documented response protocols", "Regulatory readiness"]} icon={<Shield className="w-10 h-10" />} />
      </div>
    </div>
  );
}

function ClosingSlide() {
  return (
    <div className="w-full h-full flex flex-col justify-center items-center bg-gradient-to-br from-[hsl(220,30%,8%)] via-[hsl(220,25%,12%)] to-[hsl(220,20%,6%)] text-white px-40 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[700px] h-[700px] rounded-full bg-orange-500/5 blur-3xl" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-blue-500/5 blur-3xl" />

      <div className="flex items-center gap-5 mb-10">
        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
          <Flame className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-[72px] font-extrabold tracking-tight">Exafluence</h1>
      </div>
      <div className="w-24 h-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full mb-10" />
      <p className="text-[38px] text-white/70 font-light text-center max-w-[1000px] leading-relaxed mb-16">
        From satellite detection to operational decision —<br />
        in minutes, not hours.
      </p>
      <div className="flex items-center gap-6">
        <div className="px-10 py-5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-[24px] font-bold">
          Request a Live Demo
        </div>
        <div className="px-10 py-5 rounded-xl border-2 border-white/20 text-[24px] font-medium text-white/70">
          View Command Center →
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function StatBlock({ number, label, color }: { number: string; label: string; color: string }) {
  return (
    <div className="w-full rounded-xl border border-white/10 bg-white/5 p-8 text-center">
      <p className={`text-[56px] font-extrabold ${color}`}>{number}</p>
      <p className="text-[20px] text-white/50 mt-2">{label}</p>
    </div>
  );
}

function FeatureCard({ icon, title, desc, color, borderColor }: { icon: React.ReactNode; title: string; desc: string; color: string; borderColor: string }) {
  return (
    <div className={`rounded-2xl border ${borderColor} bg-gradient-to-b ${color} p-10`}>
      <div className="mb-6 text-white/80">{icon}</div>
      <h3 className="text-[28px] font-bold mb-4">{title}</h3>
      <p className="text-[20px] text-white/60 leading-relaxed">{desc}</p>
    </div>
  );
}

function DiffRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-5">
      <div className="mt-1 flex-shrink-0">{icon}</div>
      <div>
        <h3 className="text-[26px] font-bold mb-1">{title}</h3>
        <p className="text-[20px] text-white/50 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function RiskRow({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className={`w-5 h-5 rounded-full ${color} flex-shrink-0`} />
      <div>
        <p className="text-[22px] font-bold">{label}</p>
        <p className="text-[16px] text-white/40">{desc}</p>
      </div>
    </div>
  );
}

function ValueCard({ icon, title, desc, color }: { icon: React.ReactNode; title: string; desc: string; color: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-10">
      <div className={`mb-6 ${color}`}>{icon}</div>
      <h3 className="text-[28px] font-bold mb-4">{title}</h3>
      <p className="text-[20px] text-white/50 leading-relaxed">{desc}</p>
    </div>
  );
}

function CapRow({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-5 p-6 rounded-xl border border-white/10 bg-white/[0.03]">
      <span className="text-[36px] flex-shrink-0">{icon}</span>
      <div>
        <h3 className="text-[24px] font-bold mb-1">{title}</h3>
        <p className="text-[18px] text-white/50 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function AudienceCard({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-10">
      <div className="text-cyan-400 mb-6">{icon}</div>
      <h3 className="text-[28px] font-bold mb-6">{title}</h3>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-3 text-[20px] text-white/60">
            <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Main Presentation ──────────────────────────────────────── */

const SLIDES: Slide[] = [
  { id: "title", section: "Opening", content: <TitleSlide /> },
  { id: "problem", section: "The Challenge", content: <ProblemSlide /> },
  { id: "what-we-do", section: "What We Do", content: <WhatWeDoSlide /> },
  { id: "live-map", section: "Live Demo", content: <LiveMapSlide /> },
  { id: "differentiator", section: "Differentiator", content: <DifferentiatorSlide /> },
  { id: "business-value", section: "Business Value", content: <BusinessValueSlide /> },
  { id: "capabilities", section: "Capabilities", content: <CapabilitiesSlide /> },
  { id: "audience", section: "Audience", content: <AudienceSlide /> },
  { id: "closing", section: "Closing", content: <ClosingSlide /> },
];

export default function DemoPresentation() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const next = useCallback(() => setCurrent((c) => Math.min(c + 1, SLIDES.length - 1)), []);
  const prev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Escape") {
        if (document.fullscreenElement) document.exitFullscreen();
        else navigate("/");
      }
      if (e.key === "f" || e.key === "F5") { e.preventDefault(); toggleFullscreen(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, navigate]);

  // Auto-hide controls
  useEffect(() => {
    const handleMove = () => {
      setShowControls(true);
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    };
    window.addEventListener("mousemove", handleMove);
    return () => { window.removeEventListener("mousemove", handleMove); clearTimeout(hideTimer.current); };
  }, []);

  // Fullscreen events
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  };

  return (
    <div className="fixed inset-0 bg-[hsl(220,30%,6%)] z-[9999] select-none" ref={containerRef}>
      {/* Slide canvas */}
      <div className="absolute inset-0 overflow-hidden">
        <ScaledSlide containerRef={containerRef}>
          {SLIDES[current].content}
        </ScaledSlide>
      </div>

      {/* Controls overlay */}
      <div className={`absolute inset-x-0 bottom-0 transition-opacity duration-500 ${showControls ? "opacity-100" : "opacity-0"}`}>
        {/* Progress bar */}
        <div className="h-1 bg-white/10 mx-6 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-500"
            style={{ width: `${((current + 1) / SLIDES.length) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between px-6 pb-5">
          {/* Left: back + slide info */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Exit
            </button>
            <span className="text-white/20 text-sm">|</span>
            <span className="text-white/40 text-sm font-mono">
              {current + 1} / {SLIDES.length}
            </span>
            {SLIDES[current].section && (
              <span className="text-white/25 text-sm">{SLIDES[current].section}</span>
            )}
          </div>

          {/* Center: nav */}
          <div className="flex items-center gap-3">
            <button
              onClick={prev}
              disabled={current === 0}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-20 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Slide dots */}
            <div className="flex items-center gap-1.5">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`rounded-full transition-all ${
                    i === current
                      ? "w-6 h-2 bg-orange-500"
                      : "w-2 h-2 bg-white/20 hover:bg-white/40"
                  }`}
                />
              ))}
            </div>

            <button
              onClick={next}
              disabled={current === SLIDES.length - 1}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-20 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Right: fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-all"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
