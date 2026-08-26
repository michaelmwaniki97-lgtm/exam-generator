import { TextbookManager } from "@/components/admin/textbook-manager";
import { getCatalogRepository } from "@/lib/catalog";
import { getAdminReportingRepository } from "@/lib/admin-reporting";
import { getAdminTextbookReadRepository } from "@/lib/textbook-read";

export default async function AdminTextbooksPage() {
  const catalog = await getCatalogRepository();
  const reporting = await getAdminReportingRepository();
  const textbookReads = await getAdminTextbookReadRepository();
  const [{ data: books }, documents, subjects, grades] = await Promise.all([
    reporting.listTextbookMetadata().then((data) => ({ data })),
    textbookReads.listAdminTextbookDocuments().catch(() => []),
    catalog.listSubjectsByName(),
    catalog.listGradeOptionsByName(),
  ]);
  return <div className="flex flex-col gap-6"><div><h2 className="text-2xl font-bold">Textbook grounding</h2><p className="mt-1 text-sm text-foreground/60">Private authorized PDFs for curriculum-scoped exam generation.</p></div><TextbookManager books={(books ?? []) as never[]} documents={documents as never[]} subjects={subjects} grades={grades} /></div>;
}
