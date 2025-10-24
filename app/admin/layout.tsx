import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "Admin | ExamBot",
  description: "Admin portal for creating and assigning exams",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${spaceGrotesk.variable} min-h-dvh bg-black text-white`}
      style={{ fontFamily: "var(--font-space-grotesk)" }}
    >
      <header className="border-b-2 border-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Admin</h1>
          <nav className="text-sm space-x-4">
            <Link href="/" className="underline underline-offset-4 hover:no-underline">
              Home
            </Link>
            <Link href="/admin/exams" className="underline underline-offset-4 hover:no-underline">
              Exams
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
