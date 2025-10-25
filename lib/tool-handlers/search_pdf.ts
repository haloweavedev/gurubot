import { prisma } from "@/lib/db/prisma";
import { resolveExamId } from "@/app/api/vapi/utils";
import type { ToolHandler } from "./types";

type Args = { examId?: number | string; email?: string; query: string; limit?: number };

function snippet(text: string, idx: number, len = 240) {
  const start = Math.max(0, idx - Math.floor(len / 2));
  const end = Math.min(text.length, start + len);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

export const searchPdfHandler: ToolHandler<Args> = async ({ state, args, toolCallId }) => {
  if (!args?.query) {
    const err = "Missing query";
    return { toolResponse: { toolCallId, error: err, message: { type: "request-failed", content: err } }, newState: state };
  }
  const examId = await resolveExamId({ examId: args?.examId, email: args?.email });
  const docs = await prisma.document.findMany({ where: { examId, text: { not: null } }, select: { id: true, name: true, text: true } });
  const out: { docId: number; name: string; snippet: string }[] = [];
  const limit = Number.isFinite(Number(args?.limit)) ? Number(args.limit) : 3;
  for (const d of docs) {
    const text = d.text ?? "";
    const idx = text.toLowerCase().indexOf(String(args.query).toLowerCase());
    if (idx >= 0) out.push({ docId: d.id, name: d.name, snippet: snippet(text, idx) });
    if (out.length >= limit) break;
  }
  const speak = out.length ? `Found a relevant passage: ${out[0].snippet}` : `No strong matches for that.`;
  return { toolResponse: { toolCallId, result: { results: out }, message: { type: "request-complete", content: speak } }, newState: state };
};
