import type { PredictionsChatConfig } from "@/components/PredictionsChatPanel";

export const PREDICTIONS_CONFIG: Record<string, { chatTab: string; predictionsTab: string; config: PredictionsChatConfig }> = {
  customer: {
    chatTab: "Safety Hub",
    predictionsTab: "SafetyGuard",
    config: {
      name: "SafetyGuard",
      subtitle: "AI-powered wildfire safety insights for your area",
      suggestions: [
        "Is my area at risk of a power shutoff?",
        "What's the current wildfire risk near my ZIP code?",
        "Are there any high-risk circuits affecting my service?",
        "How many customers could be impacted by PSPS?",
      ],
    },
  },
  agent: {
    chatTab: "Agent Assist",
    predictionsTab: "RiskAdvisor",
    config: {
      name: "RiskAdvisor",
      subtitle: "Risk intelligence for customer-facing decisions",
      suggestions: [
        "Which circuits are at critical ignition risk?",
        "Show customer density for high-risk circuits",
        "Are there medical baseline customers on critical circuits?",
        "What's the 72-hour risk outlook?",
      ],
    },
  },
  executive: {
    chatTab: "Ops Brief",
    predictionsTab: "GridOracle",
    config: {
      name: "GridOracle",
      subtitle: "Strategic risk forecasting and grid intelligence",
      suggestions: [
        "Which PSAs have elevated seasonal risk?",
        "Show circuits approaching critical thresholds",
        "Where is fire spreading fastest right now?",
        "How many customers are on high-risk circuits?",
      ],
    },
  },
  field: {
    chatTab: "Field Comms",
    predictionsTab: "FireSight",
    config: {
      name: "FireSight",
      subtitle: "Predictive fire intelligence for field operations",
      suggestions: [
        "Which circuits need priority patrolling?",
        "Show fire spread predictions for my area",
        "What's the ignition risk for the next 48 hours?",
        "Are there critical customers on nearby circuits?",
      ],
    },
  },
};
