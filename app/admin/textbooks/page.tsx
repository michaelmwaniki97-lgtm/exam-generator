import { TextbookManager } from "@/components/admin/textbook-manager";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCatalogRepository } from "@/lib/catalog";

export default async function AdminTextbooksPage() {
  const supabase = createAdminClient();
  const catalog = await getCatalogRepository();
  const [{ data: books }, { data: documents }, subjects, grades] = await Promise.all([
    supabase.from("textbooks").select("id, name, publisher, subject:subjects(name), grade:grades(name)").order("name"),
    supabase.from("textbook_documents").select("id, textbook_id, original_filename, file_size, processing_status, processing_error, page_count, chunk_count, source_type, created_at").order("created_at", { ascending: false }),
    catalog.listSubjectsByName(),
    catalog.listGradeOptionsByName(),
  ]);
  return <div className="flex flex-col gap-6"><div><h2 className="text-2xl font-bold">Textbook grounding</h2><p className="mt-1 text-sm text-foreground/60">Private authorized PDFs for curriculum-scoped exam generation.</p></div><TextbookManager books={(books ?? []) as never[]} documents={(documents ?? []) as never[]} subjects={subjects} grades={grades} /></div>;
}
