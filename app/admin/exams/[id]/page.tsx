import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { GeneratePlanButton } from "@/app/components/admin/GeneratePlanButton";

export const dynamic = "force-dynamic";

type Plan = {
  outline?: { title: string; summary?: string }[];
  questions?: { id: string; prompt: string; competency?: string }[];
  rubricSummary?: string;
};


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-2 border-white p-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-2 text-sm text-zinc-200">{children}</div>
    </section>
  );
}

export default async function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  const exam = await prisma.exam.findUnique({
    where: { id: idNum },
    include: {
      documents: { select: { id: true, name: true, mimeType: true, url: true } },
      assignments: { select: { id: true, assignee: true, status: true } },
    },
  });
  if (!exam) {
    return (
      <div className="border-2 border-white p-4">
        <p className="text-zinc-200">Exam not found.</p>
        <p className="mt-2"><Link href="/admin/exams" className="underline underline-offset-4">Back to list</Link></p>
      </div>
    );
  }

  const plan = exam.plan as unknown as Plan | null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Exam #{exam.id} — {exam.title}</h2>
          <p className="text-zinc-300 mt-1">
            Created {new Date(exam.createdAt).toLocaleString()} • Updated {new Date(exam.updatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <GeneratePlanButton examId={exam.id} />
          <Link href={`/learner/exams/${exam.id}`} className="underline underline-offset-4">Open Learner Exam</Link>
          <Link href="/admin/exams" className="underline underline-offset-4">Back to list</Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Objectives">
          {exam.objectives ? <pre className="whitespace-pre-wrap text-zinc-100">{exam.objectives}</pre> : <span className="text-zinc-400">None</span>}
        </Section>
        <Section title="Rubric">
          {exam.rubric ? <pre className="whitespace-pre-wrap text-zinc-100">{exam.rubric}</pre> : <span className="text-zinc-400">None</span>}
        </Section>
      </div>

      <Section title="Documents">
        {exam.documents.length === 0 ? (
          <span className="text-zinc-400">No documents</span>
        ) : (
          <ul className="list-disc pl-5 space-y-1">
            {exam.documents.map((d) => (
              <li key={d.id}>
                <a className="underline underline-offset-4" href={d.url} target="_blank" rel="noreferrer">
                  {d.name}
                </a>
                <span className="text-zinc-400"> — {d.mimeType}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Assignments">
        {exam.assignments.length === 0 ? (
          <span className="text-zinc-400">No assignments</span>
        ) : (
          <ul className="space-y-1">
            {exam.assignments.map((a) => (
              <li key={a.id}>
                <span className="font-medium">{a.assignee}</span>
                <span className="text-zinc-400"> — {a.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Plan (Generated)">
        {!plan ? (
          <span className="text-zinc-400">No plan yet</span>
        ) : (
          <div className="space-y-3">
            {plan.rubricSummary ? (
              <div>
                <div className="font-semibold">Rubric Summary</div>
                <div className="text-zinc-100 whitespace-pre-wrap">{plan.rubricSummary}</div>
              </div>
            ) : null}
            {plan.outline && plan.outline.length > 0 ? (
              <div>
                <div className="font-semibold">Outline</div>
                <ul className="list-disc pl-5">
                  {plan.outline.map((o, i) => (
                    <li key={i}>
                      <span className="font-medium">{o.title}</span>
                      {o.summary ? <span className="text-zinc-400"> — {o.summary}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {plan.questions && plan.questions.length > 0 ? (
              <div>
                <div className="font-semibold">Questions</div>
                <ol className="list-decimal pl-5">
                  {plan.questions.map((q) => (
                    <li key={q.id} className="mb-1">
                      <span className="font-medium">{q.prompt}</span>
                      {q.competency ? <span className="text-zinc-400"> — {q.competency}</span> : null}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        )}
      </Section>
    </div>
  );
}
