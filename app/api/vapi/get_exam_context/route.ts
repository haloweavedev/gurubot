import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { resolveExamId } from "../utils";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { examId?: number | string; email?: string };
    const examId = await resolveExamId({ examId: body.examId, email: body.email });
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    const plan = (exam.plan ?? null) as unknown;
    return NextResponse.json({
      exam: {
        id: exam.id,
        title: exam.title,
        objectives: exam.objectives,
        rubric: exam.rubric,
        plan,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

