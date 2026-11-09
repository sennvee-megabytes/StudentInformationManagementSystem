"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound } from "lucide-react";

type ChangePasswordResponse = {
  data?: {
    id: string;
    username: string;
    role: "STUDENT" | "STAFF" | "ADMIN";
    mustChangePassword: boolean;
  };
  error?: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
};

export function ChangePasswordForm({ forced }: { forced?: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (newPassword !== confirmPassword) {
      setFieldErrors({ confirmPassword: ["Passwords do not match."] });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const body = (await res.json()) as ChangePasswordResponse;
      if (!res.ok || !body.data) {
        setError(body.error?.message ?? "Could not change password.");
        if (body.error?.fieldErrors) {
          setFieldErrors(body.error.fieldErrors);
        }
        return;
      }

      const dest =
        body.data.role === "ADMIN"
          ? "/admin"
          : body.data.role === "STAFF"
            ? "/staff"
            : "/student";

      router.push(dest);
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      {forced && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
          You signed in with a temporary password. Please set a new personal password to continue.
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div>
        <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-700">
          Current / Temporary Password
        </label>
        <div className="relative mt-1">
          <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="currentPassword"
            name="currentPassword"
            type={showPasswords ? "text" : "password"}
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={loading}
            className="block w-full rounded-lg border border-slate-300 py-2 pl-9 pr-10 text-sm shadow-xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
          <button
            type="button"
            onClick={() => setShowPasswords((p) => !p)}
            aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
          >
            {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {fieldErrors.currentPassword?.[0] && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.currentPassword[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700">
          New Password (at least 10 characters)
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type={showPasswords ? "text" : "password"}
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={loading}
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
        />
        {fieldErrors.newPassword?.[0] && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.newPassword[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
          Confirm New Password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type={showPasswords ? "text" : "password"}
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
        />
        {fieldErrors.confirmPassword?.[0] && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.confirmPassword[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:opacity-60"
      >
        {loading ? "Updating password..." : "Update Password"}
      </button>
    </form>
  );
}
