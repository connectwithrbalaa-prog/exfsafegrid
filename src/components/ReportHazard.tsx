import { useState } from "react";
import { Camera, AlertTriangle, TreePine, HelpCircle, Send } from "lucide-react";
import { toast } from "sonner";

const HAZARD_TYPES = [
  { label: "Hazardous Pole", icon: AlertTriangle },
  { label: "Vegetation Contact", icon: TreePine },
  { label: "Other", icon: HelpCircle },
] as const;

interface ReportHazardProps {
  customerName?: string;
}

export default function ReportHazard({ customerName }: ReportHazardProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePhotoUpload = () => {
    // Simulate photo selection
    setPhotoName("hazard_photo.jpg");
    toast.info("Photo attached");
  };

  const handleSubmit = () => {
    if (!selectedType) {
      toast.error("Please select a hazard type");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      toast.success(
        `Hazard report submitted to Safety Team — 30-day review promised`,
        { description: `${selectedType}${customerName ? ` near ${customerName}'s location` : ""}` }
      );
      setSelectedType(null);
      setDescription("");
      setPhotoName(null);
      setSubmitting(false);
    }, 600);
  };

  return (
    <div className="p-5 rounded-lg border border-border bg-card space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-warning" />
        <h3 className="text-sm font-semibold text-card-foreground">Field Reporting: Report It</h3>
      </div>

      {/* Photo + Hazard Type */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handlePhotoUpload}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
            photoName
              ? "border-success/50 bg-success/10 text-success"
              : "border-border hover:bg-secondary text-foreground"
          }`}
        >
          <Camera className="w-3 h-3" />
          {photoName ? "📸 Photo Attached" : "📸 Upload Photo"}
        </button>
        {HAZARD_TYPES.map(({ label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => setSelectedType(selectedType === label ? null : label)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
              selectedType === label
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border hover:bg-secondary text-foreground"
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Description */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe the hazard..."
        className="w-full h-20 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
      />

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !selectedType}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        <Send className="w-3.5 h-3.5" />
        {submitting ? "Submitting…" : "Submit to Safety Team → 30-day review promised"}
      </button>
    </div>
  );
}