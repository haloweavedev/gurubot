import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { resolveAttempt, resolveExamId } from "../utils";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      attemptId?: number | string;
      examId?: number | string;
      email?: string;
      role: "assistant" | "user" | string;
      text: string;
      ts?: string | number;
    };
    if (!body?.text || !body?.role) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    const examId = await resolveExamId({ examId: body.examId, email: body.email }).catch(() => undefined);
    const attempt = await resolveAttempt({ attemptId: body.attemptId, examId, email: body.email });
    const ts = body.ts ? new Date(body.ts) : new Date();
    await prisma.transcript.create({
      data: { attemptId: attempt.id, role: body.role, text: body.text, ts },
    });
    return NextResponse.json({ ok: true, attemptId: attempt.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

