import { requirePageRole } from "@/lib/authz";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export default async function StudentSettingsPage() {
  const session = await requirePageRole(["STUDENT"]);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Account Security</h1>
        <p className="mt-1 text-sm text-slate-600">
          Update the password for your student account (
          <span className="font-mono font-semibold">{session.user.username}</span>). Changing your
          password will sign out any other active sessions.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
