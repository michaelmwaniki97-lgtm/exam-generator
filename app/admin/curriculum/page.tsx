import {
  CurriculumManager,
  type CurriculumStrand,
} from "@/components/admin/curriculum-manager";
import { getCatalogRepository } from "@/lib/catalog";
import { getCurriculumReadRepository } from "@/lib/curriculum-read";

type CurriculumSearchParams = {
  grade?: string;
  subject?: string;
};

export default async function AdminCurriculumPage({
  searchParams,
}: {
  searchParams: Promise<CurriculumSearchParams>;
}) {
  const requested = await searchParams;
  const catalog = await getCatalogRepository();
  const [gradesResult, subjectsResult] = await Promise.all([
    catalog.listGradesByCreation().then((data) => ({ data, error: false })).catch(() => ({ data: [], error: true })),
    catalog.listSubjectsByName().then((data) => ({ data, error: false })).catch(() => ({ data: [], error: true })),
  ]);
  const { data: grades, error: gradesError } = gradesResult;
  const { data: subjects, error: subjectsError } = subjectsResult;

  const gradeRows = grades ?? [];
  const subjectRows = subjects ?? [];
  const selectedGrade =
    gradeRows.find((grade) => grade.id === requested.grade) ?? null;
  const selectedSubject =
    subjectRows.find((subject) => subject.id === requested.subject) ?? null;

  let strands: CurriculumStrand[] = [];
  let curriculumError = false;

  if (selectedGrade && selectedSubject) {
    const data = await getCurriculumReadRepository()
      .then((repository) => repository.listAdminHierarchy(selectedGrade.id, selectedSubject.id))
      .catch(() => null);
    curriculumError = data === null;
    strands = ((data ?? []) as CurriculumStrand[])
      .map((strand) => ({
        ...strand,
        strand_objectives: [...(strand.strand_objectives ?? [])].sort((a, b) => a.sort_order - b.sort_order),
        sub_strands: [...(strand.sub_strands ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
          .map((subStrand) => ({
            ...subStrand,
            learning_outcomes: [...(subStrand.learning_outcomes ?? [])].sort(
              (a, b) =>
                a.sort_order - b.sort_order ||
                a.description.localeCompare(b.description)
            ),
          })),
      }))
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }

  const loadError = Boolean(gradesError || subjectsError || curriculumError);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Curriculum</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Manage the stored hierarchy while preserving exact source wording and
          parent-child relationships.
        </p>
      </div>
      {loadError ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          Some curriculum records could not be loaded. Please try again.
        </p>
      ) : (
        <CurriculumManager
          grades={gradeRows}
          subjects={subjectRows}
          selectedGrade={selectedGrade}
          selectedSubject={selectedSubject}
          strands={strands}
        />
      )}
    </div>
  );
}
