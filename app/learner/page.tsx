"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });

export default function LearnerLogin() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const qUser = params.get("user");
    if (qUser) setEmail(qUser);
  }, [params]);

  return (
    <div className={`${spaceGrotesk.variable} min-h-dvh bg-black text-white`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-2xl font-bold">Learner</h1>
        <p className="text-zinc-300 mt-1">Enter your email to continue (no auth).</p>

        {!confirmed ? (
          <form
            className="mt-6 grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              try {
                localStorage.setItem("exam_user_email", email);
                localStorage.setItem("exam_user_role", "learner");
              } catch {}
              setConfirmed(true);
            }}
          >
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white text-black border-2 border-white px-3 py-2 w-full"
            />
            <button type="submit" className="border-2 border-white bg-white text-black px-4 py-2 hover:bg-black hover:text-white">
              Enter Learner Portal
            </button>
          </form>
        ) : (
          <div className="mt-6">
            <div className="bg-white text-black p-4 border-2 border-white">
              <p className="font-semibold">Signed in (mock): {email}</p>
              <p className="text-sm mt-1">Next: start the voice exam experience.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
