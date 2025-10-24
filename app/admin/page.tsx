"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="max-w-xl">Loading…</div>}>
      <AdminInner />
    </Suspense>
  );
}

function AdminInner() {
  const params = useSearchParams();
  const [email, setEmail] = useState<string>(params.get("user") ?? "");
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold">Admin</h2>
      <p className="text-zinc-300 mt-1">Enter your email to continue (no auth).</p>

      {!confirmed ? (
        <form
          className="mt-6 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              localStorage.setItem("exam_user_email", email);
              localStorage.setItem("exam_user_role", "admin");
            } catch {}
            setConfirmed(true);
          }}
        >
          <input
            type="email"
            required
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-white text-black border-2 border-white px-3 py-2 w-full"
          />
          <button type="submit" className="border-2 border-white bg-white text-black px-4 py-2 hover:bg-black hover:text-white">
            Enter Admin Portal
          </button>
        </form>
      ) : (
        <div className="mt-6">
          <div className="bg-white text-black p-4 border-2 border-white">
            <p className="font-semibold">Signed in (mock): {email}</p>
            <p className="text-sm mt-1">Next: create exams, upload refs, assign users.</p>
          </div>
        </div>
      )}
    </div>
  );
}
