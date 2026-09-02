import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileText,
  GraduationCap,
  Library,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { HowItWorksProgress, Reveal } from "./motion-reveal";
import { ProductPreview } from "./product-preview";

const primaryLink = "group inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-accent-hover active:scale-[0.98] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const secondaryLink = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-[border-color,color,transform] duration-200 hover:border-accent/40 hover:text-accent active:scale-[0.98] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const arrowMotion = "transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none";

const benefits = [
  { icon: GraduationCap, label: "Curriculum-aware" },
  { icon: ShieldCheck, label: "Teacher controlled" },
  { icon: ClipboardCheck, label: "Exam + marking scheme" },
  { icon: Download, label: "Professional PDF output" },
];

const features = [
  { icon: GraduationCap, title: "Curriculum-aligned planning", description: "Select class, subject, term, topics and assessment settings.", emphasis: true },
  { icon: Library, title: "Textbook grounding", description: "Use authorized uploaded textbooks as additional generation context." },
  { icon: Sparkles, title: "AI exam generation", description: "Generate structured assessment drafts from the teacher’s selections." },
  { icon: ClipboardCheck, title: "Marking schemes", description: "Generate marking guidance alongside the exam for teacher review.", emphasis: true },
  { icon: RefreshCw, title: "Edit & regenerate", description: "Edit or regenerate individual questions without rebuilding the entire paper." },
  { icon: FileCheck2, title: "Professional export", description: "Preview and export clean student papers and marking schemes." },
];

const steps = [
  ["01", "Choose your class and subject", "Set the education context for the paper."],
  ["02", "Select topics and assessment settings", "Define coverage, marks and difficulty."],
  ["03", "Generate and review", "Inspect the assessment draft and marking guidance."],
  ["04", "Edit, approve and export", "Refine the paper before classroom use."],
] as const;

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      <p className="mt-4 text-base leading-7 text-foreground/65">{description}</p>
    </div>
  );
}

function HeroMockup() {
  return (
    <div className="landing-hero-enter landing-hero-enter--mockup relative mx-auto w-full min-w-0 max-w-2xl rounded-2xl border border-white/10 bg-sidebar p-4 pb-12 shadow-[0_24px_65px_rgb(26_29_46_/_16%)] sm:p-6 sm:pb-14 lg:pb-12" aria-label="Exam creation and paper preview">
      <div aria-hidden="true" className="absolute inset-x-6 top-0 h-px bg-white/20" />
      <div className="relative z-10 w-full rounded-xl border border-border bg-card p-4 shadow-[0_14px_32px_rgb(0_0_0_/_16%)] sm:w-[72%] sm:p-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div><p className="text-xs font-semibold text-foreground/65">Create exam</p><p className="mt-0.5 text-sm font-bold">Assessment settings</p></div>
          <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-bold text-accent">Step 5 of 6</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-left">
          {[["Grade / Form", "Form 3"], ["Subject", "Chemistry"], ["Term", "Term 2"], ["Difficulty", "Moderate"]].map(([label, value]) => (
            <div key={label}><p className="text-[10px] font-semibold text-foreground/65">{label}</p><div className="mt-1 rounded-md border border-border bg-background/60 px-2.5 py-2 text-xs font-semibold">{value}</div></div>
          ))}
        </div>
        <div className="mt-3">
          <p className="text-[10px] font-semibold text-foreground/65">Selected topics</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{["Acids & bases", "Mole concept", "Organic chemistry"].map((topic) => <span key={topic} className="rounded-md bg-accent/10 px-2 py-1 text-[10px] font-semibold text-accent">{topic}</span>)}</div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-background px-3 py-2.5">
          <div><p className="text-[10px] text-foreground/65">Paper</p><p className="text-xs font-bold">50 marks · 60 min</p></div>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-[10px] font-bold text-white"><Sparkles size={12} aria-hidden="true" />Generate exam</span>
        </div>
      </div>
      <div className="absolute bottom-5 right-5 z-20 hidden w-[48%] rounded-lg border border-border bg-white p-5 shadow-[0_18px_40px_rgb(0_0_0_/_22%)] sm:block">
        <div className="border-b border-foreground/30 pb-2 text-center font-serif">
          <p className="text-[8px] font-bold uppercase tracking-wider text-foreground/65">School assessment</p><p className="mt-1 text-xs font-bold uppercase">Chemistry</p>
          <div className="mt-1 flex justify-center gap-3 text-[7px] text-foreground/65"><span>50 marks</span><span>60 minutes</span></div>
        </div>
        <div className="mt-3 space-y-3 font-serif text-[8px] leading-relaxed text-foreground/80">
          {["State two properties of acids.", "Calculate the amount of substance in the sample shown.", "Explain the observation recorded in the table."].map((question, index) => (
            <div key={question} className="flex gap-2"><b>{index + 1}.</b><div className="flex-1"><p>{question}</p><div className="mt-1.5 h-px bg-border" /><div className="mt-2 h-px bg-border" /></div><b>[{index + 2}]</b></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LandingMotionStyles() {
  return (
    <style>{`
      html { scroll-behavior: smooth; }
      .landing-nav-link { position: relative; transition: color 180ms ease-out; }
      .landing-nav-link::after { position: absolute; right: .75rem; bottom: .45rem; left: .75rem; height: 1px; content: ""; background: var(--accent); transform: scaleX(0); transform-origin: right; transition: transform 180ms ease-out; }
      .landing-nav-link:hover { color: var(--foreground); }
      .landing-nav-link:hover::after, .landing-nav-link:focus-visible::after { transform: scaleX(1); transform-origin: left; }
      @keyframes landing-enter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes product-preview-enter { from { opacity: 0; transform: translateX(6px); } to { opacity: 1; transform: translateX(0); } }
      .landing-hero-enter { animation: landing-enter 380ms ease-out both; }
      .landing-hero-enter--heading { animation-delay: 55ms; }
      .landing-hero-enter--body { animation-delay: 105ms; }
      .landing-hero-enter--mockup { animation-delay: 150ms; animation-duration: 430ms; }
      .landing-reveal { transition: opacity 360ms ease-out, transform 360ms ease-out; transition-delay: var(--reveal-delay, 0ms); }
      .landing-reveal[data-motion-state="pending"] { opacity: 0; transform: translateY(10px); }
      .landing-reveal[data-motion-state="visible"] { opacity: 1; transform: translateY(0); }
      .how-progress-fill { transform: scaleX(1); transition: transform 720ms cubic-bezier(.22, 1, .36, 1); }
      .how-progress-track-mobile .how-progress-fill { transform: scaleY(1); }
      .how-progress-node, .how-progress-copy { transition: opacity 240ms ease-out, transform 240ms ease-out, color 200ms ease-out, background-color 200ms ease-out, border-color 200ms ease-out; transition-delay: calc(var(--step-index) * 105ms + 70ms); }
      .how-progress[data-motion-state="pending"] .how-progress-fill { transform: scaleX(0); }
      .how-progress[data-motion-state="pending"] .how-progress-track-mobile .how-progress-fill { transform: scaleY(0); }
      .how-progress[data-motion-state="pending"] .how-progress-node { border-color: var(--border); background: var(--card); color: rgb(31 34 51 / 65%); }
      .how-progress[data-motion-state="pending"] .how-progress-copy { opacity: 0; transform: translateY(8px); }
      .how-progress[data-motion-state="visible"] .how-progress-node { border-color: var(--accent); background: var(--accent); color: white; }
      .product-preview-panel { animation: product-preview-enter 190ms ease-out both; }
      @media (max-width: 767px) {
        .landing-reveal[data-motion-state="pending"] { transform: translateY(6px); }
        .how-progress[data-motion-state="pending"] .how-progress-copy { transform: translateY(5px); }
      }
      @media (prefers-reduced-motion: reduce) {
        html { scroll-behavior: auto; }
        .landing-hero-enter, .product-preview-panel { animation: none; }
        .landing-reveal, .how-progress-fill, .how-progress-node, .how-progress-copy, .landing-nav-link::after { transition: none; }
        .landing-reveal, .landing-reveal[data-motion-state], .how-progress-copy { opacity: 1; transform: none; }
        .how-progress-fill, .how-progress-track-mobile .how-progress-fill { transform: none; }
      }
    `}</style>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen max-w-full bg-background text-foreground">
      <LandingMotionStyles />
      <header className="border-b border-border/80 bg-background/95">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-x-3 px-4 py-2 max-[374px]:pb-3 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2.5 rounded-lg pr-2 font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar text-sm font-bold text-white shadow-sm">E</span><span className="text-base">Exam Generator</span></Link>
          <nav aria-label="Main navigation" className="flex items-center gap-1 max-[374px]:w-full max-[374px]:justify-end max-[374px]:border-t max-[374px]:border-border/70 max-[374px]:pt-1 sm:gap-2">
            <a href="#features" className="landing-nav-link hidden min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:inline-flex">Features</a>
            <a href="#how-it-works" className="landing-nav-link hidden min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:inline-flex">How it works</a>
            <Link href="/login" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition-[color,transform] duration-200 hover:text-accent active:scale-[0.98] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Log in</Link>
            <Link href="/signup" className="inline-flex min-h-11 items-center rounded-lg bg-accent px-3.5 text-sm font-semibold text-white shadow-sm transition-[background-color,transform] duration-200 hover:bg-accent-hover active:scale-[0.98] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">Get started</Link>
          </nav>
        </div>
      </header>
      <main>
        <section className="mx-auto grid w-full min-w-0 max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-18 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <div className="landing-hero-enter flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-accent"><span aria-hidden="true" className="h-px w-7 bg-accent/50" />Made for Kenyan classrooms</div>
            <h1 className="landing-hero-enter landing-hero-enter--heading mt-6 text-4xl font-bold tracking-[-0.035em] sm:text-5xl lg:text-6xl lg:leading-[1.06]">Create curriculum-aligned exams with AI</h1>
            <div className="landing-hero-enter landing-hero-enter--body">
              <p className="mt-5 max-w-xl text-lg leading-8 text-foreground/75">Create exams and marking schemes from selected curriculum areas and authorized textbook content, then review and edit everything before export.</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link href="/signup" className={primaryLink}>Create your exam<ArrowRight size={16} className={arrowMotion} aria-hidden="true" /></Link><Link href="/login" className={secondaryLink}>Log in</Link></div>
              <p className="mt-5 flex items-center gap-2 text-sm text-foreground/65"><CheckCircle2 size={16} className="text-accent" aria-hidden="true" />Built for teacher-controlled assessment creation.</p>
            </div>
          </div>
          <HeroMockup />
        </section>

        <section aria-label="Product benefits" className="border-y border-border bg-card">
          <Reveal className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-6 px-4 py-7 sm:px-6 md:grid-cols-4 lg:px-8">{benefits.map(({ icon: Icon, label }) => <div key={label} className="flex items-center gap-2.5 text-sm font-semibold"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"><Icon size={17} aria-hidden="true" /></span>{label}</div>)}</Reveal>
        </section>

        <section id="features" className="scroll-mt-8 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <Reveal className="mx-auto max-w-7xl">
            <SectionHeading eyebrow="Built around your workflow" title="From curriculum choices to a complete assessment draft" description="Practical tools help teachers plan, generate, refine and prepare classroom-ready assessment documents." />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{features.map(({ icon: Icon, title, description, emphasis }) => <article key={title} className={`group rounded-lg border p-6 transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-accent/30 motion-reduce:transform-none ${emphasis ? "border-accent/20 bg-accent/5" : "border-border bg-card"}`}><div className={`flex h-10 w-10 items-center justify-center text-accent transition-colors duration-200 group-hover:bg-accent/15 ${emphasis ? "rounded-lg bg-card shadow-sm" : "rounded-full bg-accent/10"}`}><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></div><h3 className="mt-4 text-base font-semibold tracking-tight">{title}</h3><p className="mt-2 text-sm leading-6 text-foreground/68">{description}</p></article>)}</div>
          </Reveal>
        </section>

        <section id="how-it-works" className="scroll-mt-8 border-y border-border bg-card px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto w-full max-w-7xl"><Reveal><SectionHeading eyebrow="How it works" title="A clear path from setup to export" description="You choose the teaching context at every stage and remain in control of the finished assessment." /></Reveal><HowItWorksProgress steps={steps} /></div>
        </section>

        <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <Reveal className="mx-auto w-full max-w-7xl">
            <div className="mb-9 max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Inside the product</p><h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Review the paper, not just the prompt</h2><p className="mt-4 leading-7 text-foreground/70">Move from familiar assessment settings to a structured paper preview, marking scheme and editing controls in one teacher workspace.</p></div>
            <ProductPreview />
          </Reveal>
        </section>

        <section className="px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
          <Reveal className="mx-auto flex max-w-5xl flex-col gap-6 rounded-xl border border-accent/20 bg-accent/5 p-6 sm:flex-row sm:items-start sm:p-8"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-card text-accent shadow-sm"><ShieldCheck size={23} aria-hidden="true" /></div><div><h2 className="text-xl font-semibold">AI assistance, with the teacher in control</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/70">AI-generated assessments are drafts for teacher review. Teachers remain responsible for checking suitability and accuracy before use, while curriculum and source information is presented transparently. School-generated materials are not issued or endorsed by KNEC.</p></div></Reveal>
        </section>

        <section className="bg-sidebar px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-8">
          <Reveal className="mx-auto flex max-w-5xl flex-col items-center text-center"><FileText size={28} className="text-sidebar-foreground" aria-hidden="true" /><h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Ready to create your next assessment?</h2><p className="mt-4 max-w-xl text-sm leading-6 text-sidebar-foreground">Choose your curriculum areas, generate a structured draft and shape it into a paper that fits your classroom.</p><div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row"><Link href="/signup" className={primaryLink}>Get started<ArrowRight size={16} className={arrowMotion} aria-hidden="true" /></Link><Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-white/5 active:scale-[0.98] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Log in</Link></div></Reveal>
        </section>
      </main>
      <footer className="border-t border-white/10 bg-sidebar px-4 py-8 text-sidebar-foreground sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-bold text-white">Exam Generator</p><p className="mt-1 text-sm">AI-assisted assessment creation for Kenyan teachers.</p><p className="mt-3 max-w-2xl text-xs leading-5 text-sidebar-foreground/70">School-generated assessment materials are teacher-reviewed resources and are not issued or endorsed by KNEC.</p></div><nav aria-label="Footer navigation" className="flex gap-2"><Link href="/login" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Log in</Link><Link href="/signup" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Get started</Link></nav></div></footer>
    </div>
  );
}
