import { PriceForm } from "@/components/payments/price-form";
import { getExamPackagePrice } from "@/lib/payments/server";

export default async function AdminSettingsPage() {
  const price = await getExamPackagePrice();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Settings</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-foreground/65">
          Manage the price teachers pay to unlock an exam paper and its marking
          scheme.
        </p>
      </div>
      <PriceForm currentPrice={price} />
    </div>
  );
}
