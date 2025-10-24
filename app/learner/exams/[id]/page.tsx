import { prisma } from "@/lib/db/prisma";
import { VapiWidget } from "@/app/components/learner/VapiWidget";

export const dynamic = "force-dynamic";

export default async function LearnerExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const examId = Number(id);
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) {
    return <div className="border-2 border-white p-4">Exam not found.</div>;
  }
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{exam.title}</h2>
        <p className="text-zinc-300 mt-1">Start the voice exam below.</p>
      </div>
      {/* Email is set client-side from localStorage by the widget attributes */}
      {/* We cannot access localStorage here; leave email undefined. */}
      <VapiWidget examId={examId} />
    </div>
  );
}

