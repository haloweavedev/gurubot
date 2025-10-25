import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const examIdParam = url.searchParams.get("examId");
    const email = url.searchParams.get("email");
    const idNum = Number(examIdParam);
    if (!Number.isFinite(idNum)) {
      return NextResponse.json({ error: "Missing or invalid examId" }, { status: 400 });
    }
    const where: Prisma.AttemptWhereInput = { examId: idNum, ...(email ? { assignee: email } : {}) };

    const attempts = await prisma.attempt.findMany({
      where,
      orderBy: [{ startedAt: "desc" }],
      take: 10,
      include: { _count: { select: { answers: true, transcripts: true } } },
    });
    return NextResponse.json({ attempts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { examId?: number | string; email?: string };
    const idNum = Number(body.examId);
    if (!Number.isFinite(idNum) || !body?.email) {
      return NextResponse.json({ error: "Missing examId or email" }, { status: 400 });
    }
    const attempt = await prisma.attempt.create({
      data: { examId: idNum, assignee: body.email, status: "in_progress" },
    });
    return NextResponse.json({ attempt }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
