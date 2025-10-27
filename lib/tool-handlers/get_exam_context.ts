import { prisma } from "@/lib/db/prisma";
import { resolveExamId, resolveAttempt, normalizeEmailLike } from "@/app/api/vapi/utils";
import type { ToolHandler } from "./types";

type Args = { examId?: number | string; email?: string; attemptId?: number | string };

export const getExamContextHandler: ToolHandler<Args> = async ({ state, args, toolCallId }) => {
  try {
    const email = normalizeEmailLike(args?.email);
    const examId = await resolveExamId({ examId: args?.examId, email });
    const attempt = await resolveAttempt({ attemptId: args?.attemptId, examId, email });
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) {
      const err = "Exam not found";
      return { toolResponse: { toolCallId, error: err, message: { type: "request-failed", content: err } }, newState: state };
    }
    const plan = (exam.plan ?? null) as unknown;
    const resultObj = {
      id: exam.id,
      title: exam.title,
      objectives: exam.objectives,
      rubric: exam.rubric,
      plan,
      attemptId: attempt.id,
    };
    return {
      toolResponse: {
        toolCallId,
        result: resultObj,
        message: { type: "request-complete", content: `We will begin ${exam.title}. Ready for the first question?` },
      },
      newState: { ...state, attempt: { id: attempt.id }, examId },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load exam context";
    const friendly = msg.includes("resolve examId") || msg.includes("resolve")
      ? "I couldn't find your exam. Please provide your email or the exam number."
      : "I couldn't load the exam context. Let's try again.";
    return { toolResponse: { toolCallId, error: msg, message: { type: "request-failed", content: friendly } }, newState: state };
  }
};
