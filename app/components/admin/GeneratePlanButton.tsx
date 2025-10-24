"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function GeneratePlanButton({ examId }: { examId: number }) {
  const [generating, setGenerating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleClick() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/exams/${examId}/plan`, { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        console.error("[GeneratePlan] API error", { status: res.status, body: text });
        throw new Error(text || "Failed to generate plan");
      }
      startTransition(() => router.refresh());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate";
      console.error("[GeneratePlan] Failed", err);
      alert(message);
    } finally {
      setGenerating(false);
    }
  }

  const busy = generating || isPending;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="border-2 border-white px-4 py-2 disabled:opacity-60"
    >
      {busy ? "Generating…" : "Generate Objectives & Rubric"}
    </button>
  );
}
