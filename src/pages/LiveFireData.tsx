import TopNav from "@/components/TopNav";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function LiveFireData() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav />
      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-lg font-bold">Live Fire Data</h1>
        </div>
        <p className="text-muted-foreground text-sm">Coming soon — active incidents, perimeters, and outlooks.</p>
      </div>
    </div>
  );
}
