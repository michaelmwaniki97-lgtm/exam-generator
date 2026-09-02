"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

type Step = readonly [number: string, label: string, description: string];

function observeOnce(element: HTMLElement) {
  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !("IntersectionObserver" in window)
  ) {
    return;
  }

  element.dataset.motionState = "pending";
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      element.dataset.motionState = "visible";
      observer.disconnect();
    },
    { rootMargin: "0px 0px -12%", threshold: 0.12 }
  );

  observer.observe(element);
  return () => observer.disconnect();
}

export function Reveal({ children, className = "", delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    return observeOnce(ref.current);
  }, []);

  return (
    <div
      ref={ref}
      className={`landing-reveal ${className}`}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function HowItWorksProgress({ steps }: { steps: readonly Step[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    return observeOnce(ref.current);
  }, []);

  return (
    <div ref={ref} className="how-progress relative mx-auto mt-12 w-full max-w-6xl">
      <div aria-hidden="true" className="how-progress-track absolute left-[12.5%] right-[12.5%] top-5 hidden h-px bg-border md:block">
        <span className="how-progress-fill block h-full origin-left bg-accent" />
      </div>
      <div aria-hidden="true" className="how-progress-track-mobile absolute bottom-5 left-5 top-5 w-px bg-border md:hidden">
        <span className="how-progress-fill block h-full origin-top bg-accent" />
      </div>
      <ol className="relative grid w-full grid-cols-1 gap-7 md:grid-cols-4 md:gap-5">
        {steps.map(([number, label, description], index) => (
          <li
            key={number}
            className="how-progress-step relative flex min-w-0 gap-4 md:flex-col md:items-center md:px-2 md:text-center"
            style={{ "--step-index": index } as CSSProperties}
          >
            <span className="how-progress-node relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent bg-accent font-mono text-xs font-bold text-white ring-4 ring-card shadow-sm">
              {number}
            </span>
            <div className="how-progress-copy min-w-0">
              <h3 className="pt-2 text-sm font-semibold md:pt-3">{label}</h3>
              <p className="mt-1.5 text-xs leading-5 text-foreground/65">{description}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
