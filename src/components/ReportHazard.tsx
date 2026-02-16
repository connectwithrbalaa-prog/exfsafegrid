import { useState, useRef } from "react";
import { Camera, AlertTriangle, TreePine, HelpCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { hazardReportSchema, validatePhoto } from "@/lib/validation";

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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const err = validatePhoto(file);
      if (err) {
        toast.error(err);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setPhotoFile(file);
      toast.info(`Photo attached: ${file.name}`);
    }
  };

  const handleSubmit = async () => {
    const parsed = hazardReportSchema.safeParse({
      hazard_type: selectedType || "",
      description,
      customer_name: customerName,
    });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || "Invalid input");
      return;
    }
    setSubmitting(true);

    try {
      let photoUrl: string | null = null;

      // Upload photo if attached
      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("hazard-photos")
          .upload(path, photoFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("hazard-photos")
          .getPublicUrl(path);
        photoUrl = urlData.publicUrl;
      }

      // Insert report
      const { error } = await supabase.from("hazard_reports").insert({
        customer_name: customerName || null,
        hazard_type: selectedType,
        description: description || null,
        photo_url: photoUrl,
      } as any);

      if (error) throw error;

      toast.success("Hazard report submitted to Safety Team — 30-day review promised", {
        description: `${selectedType}${customerName ? ` near ${customerName}'s location` : ""}`,
      });

      setSelectedType(null);
      setDescription("");
      setPhotoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      toast.error(`Failed to submit: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-5 rounded-lg border border-border bg-card space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-warning" />
        <h3 className="text-sm font-semibold text-card-foreground">Field Reporting: Report It</h3>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileChange}
        className="hidden"
      />

      {/* Photo + Hazard Type */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handlePhotoUpload}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
            photoFile
              ? "border-success/50 bg-success/10 text-success"
              : "border-border hover:bg-secondary text-foreground"
          }`}
        >
          <Camera className="w-3 h-3" />
          {photoFile ? `📸 ${photoFile.name}` : "📸 Upload Photo"}
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
