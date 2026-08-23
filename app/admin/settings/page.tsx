import { PriceForm } from "@/components/payments/price-form";
import { getExamPackagePrice } from "@/lib/payments/server";

export default async function AdminSettingsPage() {
  const price = await getExamPackagePrice();
  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-2xl font-bold text-foreground">Settings</h2>
      <PriceForm currentPrice={price}/>
    </div>
  );
}
