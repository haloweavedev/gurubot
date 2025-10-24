"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="max-w-xl">Loading…</div>}>
      <AdminInner />
    </Suspense>
  );
}

function AdminInner() {
  const params = useSearchParams();
  const [email, setEmail] = useState<string>(params.get("user") ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [title, setTitle] = useState("");
  const [objectives, setObjectives] = useState("");
  const [rubric, setRubric] = useState("");
  const [assignee, setAssignee] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(() => !!title && (files?.length ?? 0) > 0, [title, files]);

  function randId(len = 8) {
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold">Admin</h2>
      <p className="text-zinc-300 mt-1">Enter your email to continue (no auth).</p>

      {!confirmed ? (
        <form
          className="mt-6 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              localStorage.setItem("exam_user_email", email);
              localStorage.setItem("exam_user_role", "admin");
            } catch {}
            setConfirmed(true);
          }}
        >
          <input
            type="email"
            required
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-white text-black border-2 border-white px-3 py-2 w-full"
          />
          <button type="submit" className="border-2 border-white bg-white text-black px-4 py-2 hover:bg-black hover:text-white">
            Enter Admin Portal
          </button>
        </form>
      ) : (
        <div className="mt-6">
          <div className="bg-white text-black p-4 border-2 border-white space-y-4">
            <p className="font-semibold">Signed in (mock): {email}</p>
            <form
              className="grid gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!files || files.length === 0) return;
                setSaving(true);
                try {
                  const supabase = getSupabaseClient();
                  const uploaded: { name: string; mimeType: string; url: string }[] = [];
                  for (const f of Array.from(files)) {
                    const key = `${email || 'admin'}/${Date.now()}-${randId(6)}-${f.name}`;
                    const { error } = await supabase.storage.from("exams").upload(key, f, {
                      upsert: false,
                      contentType: f.type,
                    });
                    if (error) throw error;
                    const { data } = supabase.storage.from("exams").getPublicUrl(key);
                    uploaded.push({ name: f.name, mimeType: f.type || "application/octet-stream", url: data.publicUrl });
                  }

                  const res = await fetch("/api/exams", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title, objectives, rubric, assignee, documents: uploaded }),
                  });
                  if (!res.ok) throw new Error("Failed to create exam");
                  const out = await res.json();
                  // Fire-and-forget planning job
                  fetch(`/api/exams/${out.id}/plan`, { method: "POST" }).catch(() => {});
                  alert(`Exam created (#${out.id}). Planning started. Documents: ${uploaded.length}`);
                  setTitle("");
                  setObjectives("");
                  setRubric("");
                  setAssignee("");
                  setFiles(null);
                } catch (err) {
                  const message = err instanceof Error ? err.message : "Upload failed";
                  alert(message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <div>
                <label className="block text-xs uppercase font-bold">Exam Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Intro to Biology — Midterm"
                  className="mt-1 w-full border-2 border-black px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-xs uppercase font-bold">Learning Objectives</label>
                <textarea
                  value={objectives}
                  onChange={(e) => setObjectives(e.target.value)}
                  rows={3}
                  className="mt-1 w-full border-2 border-black px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs uppercase font-bold">Rubric / Answer Key</label>
                <textarea
                  value={rubric}
                  onChange={(e) => setRubric(e.target.value)}
                  rows={4}
                  className="mt-1 w-full border-2 border-black px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs uppercase font-bold">Reference PDFs</label>
                <input
                  type="file"
                  accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.ms-powerpoint"
                  multiple
                  onChange={(e) => setFiles(e.currentTarget.files)}
                  className="mt-1 block w-full border-2 border-black px-3 py-2 file:mr-4 file:border-2 file:border-black file:bg-black file:text-white file:px-3 file:py-1"
                />
              </div>
              <div>
                <label className="block text-xs uppercase font-bold">Assign to User</label>
                <input
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="sam.orton@example.com"
                  className="mt-1 w-full border-2 border-black px-3 py-2"
                />
              </div>
              <button
                type="submit"
                disabled={!canSubmit || saving}
                className="border-2 border-black bg-black text-white px-4 py-2 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Create Exam"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
