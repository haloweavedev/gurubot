"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "learner">("learner");

  return (
    <div className={`${spaceGrotesk.variable} min-h-dvh bg-black text-white flex items-center justify-center`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
      <main className="w-full max-w-xl p-6">
        <h1 className="text-3xl font-bold">ExamBot</h1>
        <p className="text-zinc-300 mt-1">Voice‑first oral exams. Brutalist, black & white.</p>

        <form
          className="mt-8 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const next = role === "admin" ? "/admin" : "/learner";
            if (email) {
              try {
                localStorage.setItem("exam_user_email", email);
                localStorage.setItem("exam_user_role", role);
              } catch {}
            }
            router.push(`${next}?user=${encodeURIComponent(email)}&type=${role}`);
          }}
        >
          <label className="block text-sm">Email</label>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white text-black border-2 border-white px-3 py-2"
          />

          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={() => setRole("learner")}
              className={`border-2 px-4 py-2 ${role === "learner" ? "bg-white text-black" : "bg-black text-white"}`}
            >
              Learner
            </button>
            <button
              type="button"
              onClick={() => setRole("admin")}
              className={`border-2 px-4 py-2 ${role === "admin" ? "bg-white text-black" : "bg-black text-white"}`}
            >
              Admin
            </button>
          </div>

          <button type="submit" className="mt-4 border-2 border-white bg-white text-black px-4 py-2 hover:bg-black hover:text-white">
            Enter {role === "admin" ? "Admin" : "Learner"}
          </button>
        </form>
      </main>
    </div>
  );
}
