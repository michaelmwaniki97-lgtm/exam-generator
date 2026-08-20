export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-lg font-bold tracking-tight text-foreground">
          Exam Generator
        </p>
        <div className="rounded-lg border border-border bg-card p-8 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
