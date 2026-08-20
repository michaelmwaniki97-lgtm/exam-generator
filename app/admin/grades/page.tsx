import { CatalogManager } from "@/components/admin/catalog-manager";
import { createClient } from "@/lib/supabase/server";

export default async function AdminGradesPage() {
  const supabase = await createClient();
  const { data: grades, error } = await supabase
    .from("grades")
    .select("id, name, level")
    .order("created_at");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Grades &amp; Classes</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Manage the existing CBC grade and 8-4-4 form structure without changing its hierarchy.
        </p>
      </div>
      {error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Grades and classes could not be loaded. Please try again.
        </p>
      ) : (
        <CatalogManager mode="grades" items={grades ?? []} />
      )}
    </div>
  );
}
