import { Wrench } from "lucide-react";

export default function AgentView() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
        <Wrench className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-bold text-foreground">Agent View</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        This panel will provide agents with tools to manage customer accounts, escalate issues, and access internal knowledge bases. Coming soon.
      </p>
    </div>
  );
}
