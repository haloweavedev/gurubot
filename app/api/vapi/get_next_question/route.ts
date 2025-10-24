import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { resolveExamId, resolveAttempt } from "../utils";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      examId?: number | string;
      attemptId?: number | string;
      email?: string;
    };
    const examId = await resolveExamId({ examId: body.examId, email: body.email });
    const attempt = await resolveAttempt({ attemptId: body.attemptId, examId, email: body.email });

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    const plan = (exam?.plan ?? null) as unknown as { questions?: { id: string; prompt: string }[] } | null;
    const questions = plan?.questions ?? [];

    const answered = await prisma.answer.findMany({
      where: { attemptId: attempt.id },
      select: { questionId: true },
    });
    const answeredIds = new Set(answered.map((a) => a.questionId));
    const next = questions.find((q) => !answeredIds.has(q.id));

    return NextResponse.json({ attemptId: attempt.id, question: next ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

