import type { ExamDocument } from "@/lib/exam-document/model";
import { formatDuration } from "@/lib/exam-document/model";
import { RichStimuli } from "@/components/exam-content/rich-stimuli";

function Field({ label }: { label: string }) { return <div className="candidate-field"><strong>{label}</strong><span /></div>; }

export function ExamDocumentView({ document }: { document: ExamDocument }) {
  return <article className="exam-paper mx-auto bg-white text-black" aria-label="Exam paper preview">
    <header className="exam-header">
      {document.school && <p className="school-name">{document.school}</p>}
      <p className="practice-notice">{document.authorityNotice ?? "Teacher-generated assessment — not an official KNEC examination."}</p>
      <h1>{document.subject}</h1>
      <h2>{document.title}</h2>
      <div className="paper-meta">
        <span>{document.grade}{document.level ? ` · ${document.level}` : ""}</span>
        {(document.term || document.year) && <span>{[document.term, document.year].filter(Boolean).join(" ")}</span>}
        {document.component && <span>{document.component}</span>}
        <span>Time: {formatDuration(document.durationMinutes)}</span><span>Total: {document.totalMarks} marks</span>
      </div>
      <div className={`candidate-grid ${document.compactCandidateFields ? "candidate-grid-compact" : ""}`}>
        <Field label="Name:"/><Field label={document.compactCandidateFields ? "Class:" : "Admission / Index No.:"}/>
        {!document.compactCandidateFields && <Field label="Class / Stream:"/>}
      </div>
    </header>
    {!!document.instructions.length && <section className="instruction-box"><h3>Instructions to candidates</h3><ol>{document.instructions.map((instruction, index) => <li key={index}>{instruction}</li>)}</ol></section>}
    <div className="exam-sections">
      {document.sections.map((section) => <section key={section.id} className="exam-section">
        <header className="section-heading"><h3>{section.title}</h3>{section.displaySectionMarks && <span>{section.marks} marks</span>}</header>
        {!!section.instructions.length && <ul className="section-instructions">{section.instructions.map((instruction, index) => <li key={index}>{instruction}</li>)}</ul>}
        <div className="questions">{section.questions.map((question) => <article key={question.slotId || `${section.id}-${question.number}`} className="exam-question">
          <div className="question-row"><span className="question-number">{question.number}.</span><div className="question-body"><p>{question.text}</p>{question.options?.map((option, index) => <p key={index} className="option"><span>{String.fromCharCode(65 + index)}.</span>{option}</p>)}</div><span className="question-marks">[{question.marks} mark{question.marks === 1 ? "" : "s"}]</span></div>
          <RichStimuli stimuli={question.stimuli} visual={question.visual}/>
        </article>)}</div>
      </section>)}
    </div>
    <p className="end-marker">END</p>
  </article>;
}
