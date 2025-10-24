-- CreateIndex
CREATE INDEX "Assignment_examId_idx" ON "Assignment"("examId");

-- CreateIndex
CREATE INDEX "Assignment_assignee_idx" ON "Assignment"("assignee");

-- CreateIndex
CREATE INDEX "Document_examId_idx" ON "Document"("examId");

-- CreateIndex
CREATE INDEX "Exam_createdAt_idx" ON "Exam"("createdAt");
