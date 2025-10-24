import { prisma } from "@/lib/db/prisma";

export async function resolveExamId(input: {
  examId?: number | string | null;
  email?: string | null;
}): Promise<number> {
  if (input.examId != null) {
    const idNum = Number(input.examId);
    if (Number.isFinite(idNum)) return idNum;
  }
  if (input.email) {
    const assignment = await prisma.assignment.findFirst({
      where: { assignee: input.email },
      orderBy: { createdAt: "desc" },
      select: { examId: true },
    });
    if (assignment) return assignment.examId;
  }
  throw new Error("Could not resolve examId");
}

export async function resolveAttempt(input: {
  attemptId?: number | string | null;
  examId?: number;
  email?: string | null;
}) {
  if (input.attemptId != null) {
    const idNum = Number(input.attemptId);
    if (Number.isFinite(idNum)) {
      const attempt = await prisma.attempt.findUnique({ where: { id: idNum } });
      if (attempt) return attempt;
    }
  }
  if (!input.examId) throw new Error("Missing examId to resolve attempt");
  // Either find in-progress for email or create one
  const existing = input.email
    ? await prisma.attempt.findFirst({
        where: { examId: input.examId, assignee: input.email, status: "in_progress" },
        orderBy: { startedAt: "desc" },
      })
    : null;
  if (existing) return existing;
  const created = await prisma.attempt.create({
    data: {
      examId: input.examId,
      assignee: input.email ?? "anonymous",
    },
  });
  return created;
}

