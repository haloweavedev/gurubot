import { prisma } from "@/lib/db/prisma";
import { resolveAttempt, resolveExamId } from "@/app/api/vapi/utils";
import type { ToolHandler } from "./types";

type Args = {
  examId?: number | string;
  attemptId?: number | string;
  email?: string;
  role: string;
  text: string;
  ts?: string;
};

export const recordTranscriptHandler: ToolHandler<Args> = async ({ state, args, toolCallId }) => {
  if (!args?.role || !args?.text) {
    const err = "Missing fields (role, text)";
    return { toolResponse: { toolCallId, error: err, message: { type: "request-failed", content: err } }, newState: state };
  }
  const examId = await resolveExamId({ examId: args?.examId, email: args?.email }).catch(() => undefined);
  const attempt = await resolveAttempt({ attemptId: args?.attemptId, examId, email: args?.email });
  const ts = args?.ts ? new Date(String(args.ts)) : new Date();
  await prisma.transcript.create({ data: { attemptId: attempt.id, role: String(args.role), text: String(args.text), ts } });
  return { toolResponse: { toolCallId, result: "recorded" }, newState: state };
};
