import { Settings } from "lucide-react";
import { PlaceholderSection } from "@/components/dashboard/placeholder-section";

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-2xl font-bold text-foreground">Settings</h2>
      <PlaceholderSection
        icon={Settings}
        title="Settings coming soon"
        description="This is where you'll configure exam pricing and other app-wide settings."
      />
    </div>
  );
}
