import Link from "next/link";

type Exam = {
  id: number;
  title: string;
  createdAt: string;
  documents: { id: number }[];
  assignments: { id: number; assignee: string; status: string }[];
};

async function fetchExams(): Promise<Exam[]> {
  const res = await fetch("/api/exams", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load exams");
  const data = (await res.json()) as { exams: Exam[] };
  return data.exams ?? [];
}

export default async function AdminExamsPage() {
  const exams = await fetchExams();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Exams</h2>
        <p className="text-zinc-300 mt-1">Recently created exams with documents and assignments.</p>
      </div>

      {exams.length === 0 ? (
        <div className="border-2 border-white p-4">
          <p className="text-zinc-200">No exams yet.</p>
          <p className="mt-2"><Link href="/admin" className="underline underline-offset-4">Create your first exam</Link>.</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {exams.map((e) => (
            <li key={e.id} className="bg-white text-black p-4 border-2 border-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">#{e.id} — {e.title}</div>
                  <div className="text-sm text-zinc-700">
                    {new Date(e.createdAt).toLocaleString()} • {e.documents.length} document{e.documents.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="text-sm text-right">
                  <div className="font-medium">Assignments</div>
                  {e.assignments.length === 0 ? (
                    <div className="text-zinc-700">None</div>
                  ) : (
                    <div className="text-zinc-800">
                      {e.assignments.map((a) => (
                        <div key={a.id}>{a.assignee} — {a.status}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

