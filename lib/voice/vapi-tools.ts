import type { VapiFunctionTool } from "./vapi-types";

// Function-type tool definitions for ExamBot
// Notes:
// - Keep descriptions directive and safe; specify sequencing.
// - Use an empty request-start message to suppress filler; speak via webhook results.

export const examFunctionTools = {
  get_exam_context(): VapiFunctionTool {
    return {
      type: "function",
      function: {
        name: "get_exam_context",
        description:
          "Load exam metadata to seed the examiner’s context. Call once at the start before asking questions; include examId or email.",
        parameters: {
          type: "object",
          properties: {
            examId: { type: "string", description: "ID of the exam to load (number or string)." },
            email: { type: "string", description: "Email of the learner to resolve latest assigned exam (optional)." },
          },
          required: [],
        },
        strict: true,
      },
      messages: [{ type: "request-start", content: "", blocking: false }],
    };
  },

  get_next_question(): VapiFunctionTool {
    return {
      type: "function",
      function: {
        name: "get_next_question",
        description:
          "Return the next unanswered question for this attempt. Create an attempt if needed using examId and email.",
        parameters: {
          type: "object",
          properties: {
            examId: { type: "string", description: "Exam ID (number or string)." },
            attemptId: { type: "string", description: "Existing attempt ID, if available." },
            email: { type: "string", description: "Learner email to resolve/create attempt if attemptId is missing." },
          },
          required: [],
        },
        strict: true,
      },
      messages: [{ type: "request-start", content: "", blocking: false }],
    };
  },

  score_answer(): VapiFunctionTool {
    return {
      type: "function",
      function: {
        name: "score_answer",
        description:
          "Score a question response 0–5 using rubric. Persist the answer and return score and brief rationale; may suggest a follow-up.",
        parameters: {
          type: "object",
          properties: {
            examId: { type: "string", description: "Exam ID to load rubric if needed." },
            attemptId: { type: "string", description: "Attempt ID to persist the answer/score." },
            email: { type: "string", description: "Learner email (optional, for resolving attempt)." },
            questionId: { type: "string", description: "Question ID being scored." },
            prompt: { type: "string", description: "The question text/prompt." },
            answerText: { type: "string", description: "Learner’s transcripted answer text." },
          },
          required: ["questionId", "prompt", "answerText"],
        },
        strict: true,
        rejectionPlan: {
          conditions: [
            { type: "liquid", liquid: "{{ function.arguments.answerText | size }} > 0" },
          ],
        },
      },
      messages: [{ type: "request-start", content: "", blocking: false }],
    };
  },

  record_transcript(): VapiFunctionTool {
    return {
      type: "function",
      function: {
        name: "record_transcript",
        description:
          "Append a transcript entry (role, text, timestamp) to the current attempt. Use for interim notes; no spoken feedback needed.",
        parameters: {
          type: "object",
          properties: {
            examId: { type: "string", description: "Exam ID (optional)." },
            attemptId: { type: "string", description: "Attempt ID to attach transcript to." },
            email: { type: "string", description: "Learner email to resolve attempt if needed." },
            role: { type: "string", description: "'assistant' or 'user'." },
            text: { type: "string", description: "Transcript text to append." },
            ts: { type: "string", description: "ISO-8601 timestamp (optional)." },
          },
          required: ["role", "text"],
        },
        strict: true,
      },
      messages: [{ type: "request-start", content: "", blocking: false }],
    };
  },

  finalize_attempt(): VapiFunctionTool {
    return {
      type: "function",
      function: {
        name: "finalize_attempt",
        description:
          "Compute the overall score from saved answers and mark the attempt as completed. Return total and a brief summary.",
        parameters: {
          type: "object",
          properties: {
            attemptId: { type: "string", description: "Attempt ID to finalize." },
          },
          required: ["attemptId"],
        },
        strict: true,
      },
      messages: [{ type: "request-start", content: "", blocking: false }],
    };
  },

  search_pdf(): VapiFunctionTool {
    return {
      type: "function",
      function: {
        name: "search_pdf",
        description:
          "Search extracted PDF text for a query and return up to 3 short snippets with document info.",
        parameters: {
          type: "object",
          properties: {
            examId: { type: "string", description: "Exam ID whose documents to search." },
            email: { type: "string", description: "Learner email (optional) for resolving exam." },
            query: { type: "string", description: "Search query text (short)." },
            limit: { type: "number", description: "Max results to return (default 3)." },
          },
          required: ["query"],
        },
      },
      messages: [{ type: "request-start", content: "", blocking: false }],
    };
  },
} as const;

export function getAllFunctionTools(): VapiFunctionTool[] {
  return [
    examFunctionTools.get_exam_context(),
    examFunctionTools.get_next_question(),
    examFunctionTools.score_answer(),
    examFunctionTools.record_transcript(),
    examFunctionTools.finalize_attempt(),
    examFunctionTools.search_pdf(),
  ];
}

