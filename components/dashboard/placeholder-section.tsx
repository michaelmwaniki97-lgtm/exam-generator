import type { LucideIcon } from "lucide-react";

export function PlaceholderSection({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card px-6 py-16 text-center shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
        <Icon size={26} strokeWidth={1.75} className="text-accent" />
      </div>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm font-normal text-foreground/65">{description}</p>
      </div>
    </div>
  );
}
