import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { attemptId: number | string };
    const idNum = Number(body.attemptId);
    if (!Number.isFinite(idNum)) return NextResponse.json({ error: "Missing attemptId" }, { status: 400 });
    const answers = await prisma.answer.findMany({ where: { attemptId: idNum } });
    const total = answers.length > 0 ? answers.reduce((s, a) => s + a.score, 0) / answers.length : 0;
    const updated = await prisma.attempt.update({
      where: { id: idNum },
      data: { status: "completed", completedAt: new Date(), totalScore: total },
    });
    return NextResponse.json({ ok: true, attemptId: updated.id, totalScore: total });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

