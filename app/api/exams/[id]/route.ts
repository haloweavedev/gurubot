import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _req: Request,
  context: unknown
) {
  const params = (context as { params?: Record<string, string> }).params ?? {};
  const idNum = Number(params.id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ error: "Invalid exam id" }, { status: 400 });
  }

  try {
    const exam = await prisma.exam.findUnique({
      where: { id: idNum },
      include: {
        documents: true,
        assignments: true,
      },
    });
    if (!exam) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ exam });
  } catch (err) {
    console.error("[exam GET]", err);
    return NextResponse.json({ error: "Failed to load exam" }, { status: 500 });
  }
}

