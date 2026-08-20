import { CatalogManager } from "@/components/admin/catalog-manager";
import { createClient } from "@/lib/supabase/server";

export default async function AdminSubjectsPage() {
  const supabase = await createClient();
  const { data: subjects, error } = await supabase
    .from("subjects")
    .select("id, name")
    .order("name");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Subjects</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Add and maintain the subjects available to curriculum and examination records.
        </p>
      </div>
      {error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Subjects could not be loaded. Please try again.
        </p>
      ) : (
        <CatalogManager mode="subjects" items={subjects ?? []} />
      )}
    </div>
  );
}
