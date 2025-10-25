import { prisma } from "@/lib/db/prisma";
import { resolveExamId, resolveAttempt } from "@/app/api/vapi/utils";
import type { ToolHandler } from "./types";

type Args = { examId?: number | string; email?: string; attemptId?: number | string };

export const getExamContextHandler: ToolHandler<Args> = async ({ state, args, toolCallId }) => {
  const examId = await resolveExamId({ examId: args?.examId, email: args?.email });
  const attempt = await resolveAttempt({ attemptId: args?.attemptId, examId, email: args?.email });
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
};
