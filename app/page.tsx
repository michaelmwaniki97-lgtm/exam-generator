import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Exam Generator | AI-Assisted Exams for Kenyan Teachers",
  description: "Create curriculum-aligned exams and marking schemes, review questions, and export professional assessment documents.",
};

export default function Home() { return <LandingPage />; }
