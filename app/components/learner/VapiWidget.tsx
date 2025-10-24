"use client";

import { useEffect, useMemo } from "react";

export function VapiWidget({ examId, email }: { examId: number; email?: string | null }) {
  const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || "";
  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || "";

  const attrs = useMemo(() => ({
    "assistant-id": assistantId,
    "public-key": publicKey,
    "data-exam-id": String(examId),
    ...(email ? { "data-email": email } : {}),
  }), [assistantId, publicKey, examId, email]);

  useEffect(() => {
    if (document.getElementById("vapi-embed-script")) return;
    const s = document.createElement("script");
    s.src = "https://unpkg.com/@vapi-ai/client-sdk-react/dist/embed/widget.umd.js";
    s.async = true;
    s.type = "text/javascript";
    s.id = "vapi-embed-script";
    document.body.appendChild(s);
  }, []);

  return (
    <div className="border-2 border-white p-4">
      <div className="text-sm mb-2">Voice Assistant</div>
      {/* @ts-expect-error web component */}
      {<vapi-widget {...attrs} />}
      <p className="text-xs text-zinc-400 mt-2">Exam ID: {examId}{email ? ` • ${email}` : ""}</p>
    </div>
  );
}

