import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Account Security
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">Change Password</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Signed in as <span className="font-medium text-slate-700">{session.user.username}</span>
            </p>
          </div>
          <LogoutButton />
        </div>

        <ChangePasswordForm forced={session.user.mustChangePassword} />
      </div>
    </main>
  );
}
