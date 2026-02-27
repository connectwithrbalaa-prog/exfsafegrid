import { useState } from "react";
import { Bot, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import PredictionsChatPanel, { type PredictionsChatConfig } from "./PredictionsChatPanel";

export interface TabbedChatPanelProps {
  /** The primary chat panel to render in the first tab */
  chatPanel: React.ReactNode;
  /** Label and icon for the primary chat tab */
  chatTabLabel: string;
  chatTabIcon?: React.ReactNode;
  /** Predictions config for second tab */
  predictionsConfig: PredictionsChatConfig;
  /** Label for the predictions tab */
  predictionsTabLabel: string;
  predictionsTabIcon?: React.ReactNode;
}

export default function TabbedChatPanel({
  chatPanel,
  chatTabLabel,
  chatTabIcon,
  predictionsConfig,
  predictionsTabLabel,
  predictionsTabIcon,
}: TabbedChatPanelProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "predictions">("chat");

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-lg border border-border bg-card">
      {/* Tab bar */}
      <div className="flex border-b border-border bg-accent/50">
        <button
          onClick={() => setActiveTab("chat")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
            activeTab === "chat"
              ? "text-foreground border-b-2 border-primary bg-card"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {chatTabIcon || <Bot className="w-3.5 h-3.5" />}
          {chatTabLabel}
        </button>
        <button
          onClick={() => setActiveTab("predictions")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
            activeTab === "predictions"
              ? "text-foreground border-b-2 border-primary bg-card"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {predictionsTabIcon || <Activity className="w-3.5 h-3.5" />}
          {predictionsTabLabel}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "chat" ? (
          <div className="h-full">{chatPanel}</div>
        ) : (
          <PredictionsChatPanel config={predictionsConfig} />
        )}
      </div>
    </div>
  );
}
