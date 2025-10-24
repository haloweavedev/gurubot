import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { resolveExamId } from "../utils";

function snippet(text: string, idx: number, len = 240) {
  const start = Math.max(0, idx - Math.floor(len / 2));
  const end = Math.min(text.length, start + len);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { examId?: number | string; email?: string; query: string; limit?: number };
    if (!body?.query) return NextResponse.json({ error: "Missing query" }, { status: 400 });
    const examId = await resolveExamId({ examId: body.examId, email: body.email });
    const docs = await prisma.document.findMany({ where: { examId, text: { not: null } }, select: { id: true, name: true, text: true } });
    const out: { docId: number; name: string; snippet: string }[] = [];
    for (const d of docs) {
      const text = d.text ?? "";
      const idx = text.toLowerCase().indexOf(body.query.toLowerCase());
      if (idx >= 0) out.push({ docId: d.id, name: d.name, snippet: snippet(text, idx) });
      if (out.length >= (body.limit ?? 3)) break;
    }
    return NextResponse.json({ results: out });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

