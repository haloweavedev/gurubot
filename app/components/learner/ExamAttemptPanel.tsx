"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Attempt = {
  id: number;
  status: string;
  startedAt: string;
  completedAt?: string | null;
  totalScore?: number | null;
  _count?: { answers: number; transcripts: number };
};

export function ExamAttemptPanel({ examId }: { examId: number }) {
  const [email, setEmail] = useState<string>("");
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    try {
      const e = localStorage.getItem("exam_user_email") || "";
      setEmail(e);
    } catch {}
  }, []);

  const load = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/attempts?examId=${examId}&email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setAttempts(json.attempts || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load attempts");
    } finally {
      setLoading(false);
    }
  }, [email, examId]);

  useEffect(() => { load(); }, [load]);

  const latest = useMemo(() => (attempts && attempts.length > 0 ? attempts[0] : null), [attempts]);

  async function handleRetake() {
    if (!email) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, email }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start retake");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="border-2 border-white p-4">
      <div className="text-sm font-semibold">Exam Progress</div>
      {!email ? (
        <div className="text-zinc-400 mt-2">Enter your email to load attempts.</div>
      ) : loading ? (
        <div className="text-zinc-400 mt-2">Loading…</div>
      ) : error ? (
        <div className="text-red-300 mt-2">{error}</div>
      ) : (
        <div className="mt-2 space-y-3">
          {latest ? (
            <div className="bg-white text-black p-3">
              <div className="text-sm">Latest attempt: #{latest.id}</div>
              <div className="text-sm">
                Status: <span className="font-medium">{latest.status}</span>
                {latest.totalScore != null ? (
                  <>
                    {" "}• Score: <span className="font-medium">{Number(latest.totalScore).toFixed(2)}</span>
                  </>
                ) : null}
              </div>
              <div className="text-xs text-zinc-700">
                Started {new Date(latest.startedAt).toLocaleString()}
                {latest.completedAt ? ` • Completed ${new Date(latest.completedAt).toLocaleString()}` : ""}
                {latest._count ? ` • Answers ${latest._count.answers}` : ""}
              </div>
            </div>
          ) : (
            <div className="text-zinc-400">No attempts yet.</div>
          )}
          <button
            type="button"
            onClick={handleRetake}
            disabled={!email || creating}
            className="border-2 border-white px-3 py-2 disabled:opacity-60"
          >
            {creating ? "Starting…" : latest?.status === "in_progress" ? "Start New Attempt" : "Retake Exam"}
          </button>
          {attempts && attempts.length > 1 ? (
            <div className="text-xs text-zinc-300">
              History: {attempts.slice(0, 5).map((a) => `#${a.id}:${a.totalScore ?? "-"}`).join(" • ")}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
