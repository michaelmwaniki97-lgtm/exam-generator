import Link from "next/link";
import { CheckCircle2, FileText, Home, Sparkles } from "lucide-react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 items-start bg-background px-4 py-4 sm:px-6 sm:py-8 lg:items-stretch lg:px-8 lg:py-10">
      <div className="mx-auto grid h-fit w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-[0_14px_38px_rgb(31_34_51_/_8%)] lg:h-auto lg:max-w-6xl lg:grid-cols-[0.9fr_1.1fr] lg:shadow-[0_22px_65px_rgb(31_34_51_/_10%)]">
        <aside className="relative hidden overflow-hidden bg-sidebar p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-sm font-bold">E</span>
              <span className="font-bold tracking-tight">Exam Generator</span>
            </Link>
            <div className="mt-16 max-w-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sidebar-foreground">Teacher-controlled assessment creation</p>
              <h2 className="mt-4 text-3xl font-bold leading-tight">From curriculum choices to a paper ready for review.</h2>
              <p className="mt-4 text-sm leading-6 text-sidebar-foreground">Build structured exam drafts and marking guidance, refine every question, then prepare a professional assessment document.</p>
            </div>
          </div>
          <div className="mt-12 rounded-lg border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold"><FileText size={17} aria-hidden="true" />Chemistry · Form 3</div><span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold">Draft</span></div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-md bg-white/5 p-3"><p className="text-sidebar-foreground">Paper</p><p className="mt-1 font-semibold text-white">50 marks · 60 min</p></div><div className="rounded-md bg-white/5 p-3"><p className="text-sidebar-foreground">Includes</p><p className="mt-1 font-semibold text-white">Marking scheme</p></div></div>
            <p className="mt-4 flex items-center gap-2 text-xs text-sidebar-foreground"><CheckCircle2 size={15} className="text-white" aria-hidden="true" />Teacher review remains part of every workflow.</p>
          </div>
          <Sparkles aria-hidden="true" className="absolute -right-4 top-24 text-white/5" size={130} strokeWidth={1} />
        </aside>
        <div className="flex min-w-0 flex-col px-5 py-5 sm:px-10 sm:py-8 lg:px-14 lg:py-11">
          <div className="mb-7 flex items-center justify-between lg:justify-end">
            <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-foreground/65 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"><Home size={16} aria-hidden="true" />Home</Link>
            <Link href="/" className="hidden min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-foreground/60 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:inline-flex"><Home size={16} aria-hidden="true" />Back to homepage</Link>
          </div>
          <div className="mx-auto flex w-full max-w-md items-start lg:flex-1 lg:items-center">
            <div className="w-full">{children}</div>
          </div>
          <p className="mx-auto mt-8 max-w-md text-center text-xs leading-5 text-foreground/45 lg:mt-10">AI-assisted assessment creation for Kenyan teachers. School-generated materials require teacher review.</p>
        </div>
      </div>
    </div>
  );
}
