import type { HandlerCtx, HandlerResult } from "./types";
import { getExamContextHandler } from "./get_exam_context";
import { getNextQuestionHandler } from "./get_next_question";
import { scoreAnswerHandler } from "./score_answer";
import { recordTranscriptHandler } from "./record_transcript";
import { finalizeAttemptHandler } from "./finalize_attempt";
import { searchPdfHandler } from "./search_pdf";

export const handlers: Record<string, (ctx: HandlerCtx<unknown>) => Promise<HandlerResult>> = {
  get_exam_context: getExamContextHandler as unknown as (ctx: HandlerCtx<unknown>) => Promise<HandlerResult>,
  get_next_question: getNextQuestionHandler as unknown as (ctx: HandlerCtx<unknown>) => Promise<HandlerResult>,
  score_answer: scoreAnswerHandler as unknown as (ctx: HandlerCtx<unknown>) => Promise<HandlerResult>,
  record_transcript: recordTranscriptHandler as unknown as (ctx: HandlerCtx<unknown>) => Promise<HandlerResult>,
  finalize_attempt: finalizeAttemptHandler as unknown as (ctx: HandlerCtx<unknown>) => Promise<HandlerResult>,
  search_pdf: searchPdfHandler as unknown as (ctx: HandlerCtx<unknown>) => Promise<HandlerResult>,
};
