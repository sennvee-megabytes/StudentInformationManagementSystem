import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { roleHomePath } from "@/lib/authz";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    if (session.user.mustChangePassword) {
      redirect("/change-password");
    }
    redirect(roleHomePath(session.user.role));
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Cavite State University
          </p>
          <h1 className="mt-1 text-xl font-bold text-slate-900">
            Student Information Management System
          </h1>
          <p className="mt-1 text-sm text-slate-500">Sign in with your account credentials</p>
        </div>

        <Suspense fallback={<div className="mt-6 h-48 animate-pulse rounded-lg bg-slate-100" />}>
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-xs text-slate-500">
          Protected under RA 10173 (Data Privacy Act of 2012). Authorized personnel and students only.
        </p>
      </div>
    </main>
  );
}
