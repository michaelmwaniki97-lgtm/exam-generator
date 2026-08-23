import type { ExamDocument } from "@/lib/exam-document/model";
import { formatDuration } from "@/lib/exam-document/model";

export function MarkingDocumentView({ document }: { document: ExamDocument }) {
  const bySlot = new Map(document.markingEntries.map((entry) => [entry.slotId ?? `number-${entry.number}`, entry]));
  return <article className="exam-paper marking-paper mx-auto bg-white text-black" aria-label="Marking scheme preview">
    <header className="exam-header"><p className="confidential-label">Teacher copy — marking scheme</p>{document.school && <p className="school-name">{document.school}</p>}<h1>{document.subject}</h1><h2>{document.title}</h2><div className="paper-meta"><span>{document.grade}</span><span>{formatDuration(document.durationMinutes)}</span><span>{document.totalMarks} marks</span></div></header>
    <div className="exam-sections">{document.sections.map((section) => <section key={section.id} className="exam-section"><header className="section-heading"><h3>{section.title}</h3></header>{section.questions.map((question) => {
      const entry = bySlot.get(question.slotId || `number-${question.number}`);
      return <article key={question.slotId || question.number} className="marking-entry"><div className="question-row"><strong>{question.number}. {entry?.markingModel?.replaceAll("_", " ") ?? "point based"}</strong><span className="question-marks">[{question.marks}]</span></div>
        {entry?.answer && <p><strong>Answer:</strong> {entry.answer}</p>}
        {!!entry?.allocations?.length && <ul>{entry.allocations.map((allocation, index) => <li key={index}>{allocation.label} — {allocation.marks} mark{allocation.marks === 1 ? "" : "s"}</li>)}</ul>}
        {entry?.numericalMethod && <div><p><strong>Expected answer:</strong> {entry.numericalMethod.finalAnswer}{entry.numericalMethod.units ? ` ${entry.numericalMethod.units}` : ""}</p><ol>{entry.numericalMethod.methodSteps.map((step, index) => <li key={index}>{step.step} — {step.marks}</li>)}</ol>{entry.numericalMethod.accuracyMarks > 0 && <p>Accuracy marks: {entry.numericalMethod.accuracyMarks}</p>}{entry.numericalMethod.tolerance && <p>Tolerance: {entry.numericalMethod.tolerance}</p>}{entry.numericalMethod.alternativeMethod && <p>Alternative method: {entry.numericalMethod.alternativeMethod}</p>}</div>}
        {!!entry?.rubric?.length && <table className="rubric-table"><thead><tr><th>Criterion</th><th>Descriptor / expectation</th><th>Marks</th></tr></thead><tbody>{entry.rubric.map((criterion) => <tr key={criterion.criterion}><th>{criterion.criterion}</th><td>{criterion.descriptor}</td><td>{criterion.marks}</td></tr>)}</tbody></table>}
        {entry?.marking_notes && <p className="marking-notes"><strong>Notes:</strong> {entry.marking_notes}</p>}
      </article>;
    })}</section>)}</div>
  </article>;
}
