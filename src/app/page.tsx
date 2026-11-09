import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
          Cavite State University
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Student Information Management System
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Centralized, role-based platform for managing student records, enrollment, and academic information.
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
          >
            Sign in to SIMS
          </Link>
        </div>
      </div>
    </main>
  );
}
