import { Receipt } from "lucide-react";
import { PlaceholderSection } from "@/components/dashboard/placeholder-section";

export default function TeacherTransactionsPage() {
  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-2xl font-bold text-foreground">Transactions</h2>
      <PlaceholderSection
        icon={Receipt}
        title="Payment history coming soon"
        description="This is where you'll see your past exam payments and receipts."
      />
    </div>
  );
}
