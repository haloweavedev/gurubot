import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

type CreateExamBody = {
  title: string;
  objectives: string;
  rubric: string;
  assignee?: string;
  documents: { name: string; mimeType: string; url: string }[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateExamBody;
    if (!body?.title) return NextResponse.json({ error: "Missing title" }, { status: 400 });
    const created = await prisma.exam.create({
      data: {
        title: body.title,
        objectives: body.objectives ?? "",
        rubric: body.rubric ?? "",
        documents: {
          create: (body.documents ?? []).map((d) => ({ name: d.name, mimeType: d.mimeType, url: d.url })),
        },
        assignments: body.assignee
          ? {
              create: { assignee: body.assignee },
            }
          : undefined,
      },
      include: { documents: true, assignments: true },
    });
    return NextResponse.json({ id: created.id, exam: created }, { status: 201 });
  } catch (err) {
    console.error("[exams POST]", err);
    return NextResponse.json({ error: "Failed to create exam" }, { status: 500 });
  }
}

