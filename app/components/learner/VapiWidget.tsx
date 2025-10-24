"use client";

import { useEffect, useMemo, useRef } from "react";

export function VapiWidget({ examId, email }: { examId: number; email?: string | null }) {
  const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || "";
  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || "";

  const widgetRef = useRef<HTMLElement | null>(null);

  const attrs = useMemo(() => ({
    // Required
    "assistant-id": assistantId,
    "public-key": publicKey,
    // Context
    "data-exam-id": String(examId),
    ...(email ? { "data-email": email } : {}),
    // Look & feel and behavior (from provided reference snippet)
    mode: "voice",
    theme: "dark",
    "base-bg-color": "#000000",
    "accent-color": "#14B8A6",
    "cta-button-color": "#000000",
    "cta-button-text-color": "#ffffff",
    "border-radius": "large",
    size: "full",
    position: "bottom-right",
    title: "TALK WITH AI",
    "start-button-text": "Start",
    "end-button-text": "End Call",
    "chat-first-message": "Hey, How can I help you today?",
    "chat-placeholder": "Type your message...",
    "voice-show-transcript": "true",
    "consent-required": "true",
    "consent-title": "Terms and conditions",
    // Note the embedded quotes inside the content string
    "consent-content": 'By clicking "Agree," and each time I interact with this AI agent, I consent to the recording, storage, and sharing of my communications with third-party service providers, and as otherwise described in our Terms of Service.',
    "consent-storage-key": "vapi_widget_consent",
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

  // After mount, if no email prop was passed, try to populate from localStorage
  useEffect(() => {
    if (email) return; // already provided
    try {
      const stored = localStorage.getItem("exam_user_email");
      if (stored && widgetRef.current) {
        widgetRef.current.setAttribute("data-email", stored);
      }
    } catch {}
  }, [email]);

  return (
    <div className="border-2 border-white p-4">
      <div className="text-sm mb-2">Voice Assistant</div>
      {/* @ts-expect-error web component */}
      {<vapi-widget ref={widgetRef as unknown as React.RefObject<HTMLElement>} {...attrs} />}
      <p className="text-xs text-zinc-400 mt-2">Exam ID: {examId}{email ? ` • ${email}` : ""}</p>
    </div>
  );
}
