import { prisma } from "@/lib/db/prisma";

export function normalizeEmailLike(input?: string | null): string | undefined {
  if (!input) return undefined;
  let s = String(input).trim().toLowerCase();
  // common speech artifacts
  s = s.replace(/\s+at\s+/g, "@");
  s = s.replace(/\s+dot\s+/g, ".");
  s = s.replace(/\s+underscore\s+/g, "_");
  s = s.replace(/\s+(dash|hyphen)\s+/g, "-");
  s = s.replace(/\s+plus\s+/g, "+");
  s = s.replace(/\s+(period|point)\s+/g, ".");
  // collapse spaces
  s = s.replace(/\s+/g, "");
  // fix common endings
  s = s.replace(/@gmailcom$/, "@gmail.com");
  s = s.replace(/@yahooCom$/i, "@yahoo.com");
  s = s.replace(/@outlookCom$/i, "@outlook.com");
  return s;
}

export async function resolveExamId(input: {
  examId?: number | string | null;
  email?: string | null;
}): Promise<number> {
  if (input.examId != null) {
    const idNum = Number(input.examId);
    if (Number.isFinite(idNum)) return idNum;
  }
  const normalizedEmail = normalizeEmailLike(input.email);
  if (normalizedEmail) {
    const assignment = await prisma.assignment.findFirst({
      where: { assignee: normalizedEmail },
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
