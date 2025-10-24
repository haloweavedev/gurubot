# ExamBot MVP User Flow

## Overview
- Goal: Validate a voice‑first oral exam using VAPI (TTS/voice loop) with tool calls to fetch context from uploaded PDFs and rubric‑based scoring. No real auth — users enter an email + role on the landing page.

## Roles & Entry
- Landing (`/`): Enter email and pick role (Admin or Learner). We store in `localStorage` and pass as query params.
- Admin (`/admin`): Create exam, upload PDFs, provide learning objectives and rubric, assign to a user.
- Learner (`/learner`): Confirm email and start the voice exam.

## Admin Flow (Create → Assign)
1) Create Exam: title, objectives, rubric.
2) Upload PDFs (reference material). Store in Supabase Storage; DB rows in `Document` linked to `Exam`.
3) Assign to user (email string). Creates `Assignment` row.

## Preprocessing (AI SDK – Learning Path)
- After upload, run a server job to create a lightweight “learning path” from the PDF(s):
  - Outline key sections and concepts.
  - Generate 5–10 competency questions aligned to objectives.
  - Summarize rubric criteria.
- Store in DB (e.g., on `Exam` as JSON fields) or a new `ExamPlan` table later.

## Learner Flow (Voice Session)
1) Learner starts exam; VAPI greets and explains flow.
2) VAPI asks first question (from AI SDK generated plan or rubric‑derived).
3) Learner answers by voice; STT transcript captured.
4) Tool calls fetch relevant PDF snippets and apply rubric to score.
5) VAPI gives brief feedback and moves to next question (3–5 Qs for MVP).
6) End with total score and short feedback summary; store transcript and results.

## VAPI Tool Calls (server‑side)
- get_exam_context(examId): returns objectives, rubric summary, learning path.
- search_pdf(examId, query): returns snippet + citation (doc id, page).
- get_next_question(examId, attemptId): returns next question or null.
- score_answer(examId, questionId, answerText): returns score (0–5), rationale, follow‑up suggestion.
- record_transcript(attemptId, role, text, ts): append to transcript log.
- finalize_attempt(attemptId): compute totals and persist summary.

Inputs: JSON; Outputs: JSON. VAPI invokes these tools; our API executes them and returns results.

## Data Model (current + near‑term)
- Current: `Exam`, `Document`, `Assignment`.
- Near‑term add: `Attempt` (exam run), `Answer` (per question), `Transcript` (utterance log).

## Success Criteria
- Admin creates an exam with 1 PDF and rubric.
- Learner completes a 3‑question voice session.
- Tool calls fetch at least one PDF snippet and compute rubric‑based feedback.
- Transcript + result stored; simple summary displayed.

..