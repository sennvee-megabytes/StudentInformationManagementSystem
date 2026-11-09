"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { TempPasswordDialog } from "@/components/admin/temp-password-dialog";

type StaffAccountItem = {
  id: string;
  username: string;
  email: string | null;
  role: "STUDENT" | "STAFF" | "ADMIN";
  status: "ACTIVE" | "INACTIVE" | "LOCKED";
  mustChangePassword: boolean;
  failedLoginCount: number;
  lockedUntil: string | Date | null;
  lastLoginAt: string | Date | null;
};

export function StaffManager({
  currentUserId,
  initialUsers,
}: {
  currentUserId: string;
  initialUsers: StaffAccountItem[];
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"STAFF" | "ADMIN">("STAFF");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [issuedCreds, setIssuedCreds] = useState<{
    title: string;
    username: string;
    temporaryPassword: string;
  } | null>(null);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email: email.trim() ? email.trim() : null,
          role,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.message ?? "Failed to create account.");
        return;
      }
      setUsername("");
      setEmail("");
      setIssuedCreds({
        title: "Staff / Admin Account Created",
        username: body.data.user.username,
        temporaryPassword: body.data.temporaryPassword,
      });
      router.refresh();
    } catch {
      setError("Network error while creating account.");
    } finally {
      setLoading(false);
    }
  }

  async function updateAccount(
    user: StaffAccountItem,
    patch: {
      role?: "STAFF" | "ADMIN";
      status?: "ACTIVE" | "INACTIVE";
      unlock?: boolean;
      resetPassword?: boolean;
    }
  ) {
    setError(null);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error?.message ?? "Update failed.");
      return;
    }
    if (body.data?.temporaryPassword) {
      setIssuedCreds({
        title: "Temporary Password Reset",
        username: user.username,
        temporaryPassword: body.data.temporaryPassword,
      });
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {issuedCreds && (
        <TempPasswordDialog
          title={issuedCreds.title}
          username={issuedCreds.username}
          temporaryPassword={issuedCreds.temporaryPassword}
          onClose={() => setIssuedCreds(null)}
        />
      )}

      <form
        onSubmit={handleCreate}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
      >
        <h2 className="text-sm font-semibold text-slate-900">Create Staff or Administrator Account</h2>
        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="username" className="block text-xs font-medium text-slate-700">
              Username
            </label>
            <input
              id="username"
              required
              placeholder="e.g. registrar_juan"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-slate-700">
              Email (Optional)
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="role" className="block text-xs font-medium text-slate-700">
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as "STAFF" | "ADMIN")}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            >
              <option value="STAFF">STAFF (Registrar)</option>
              <option value="ADMIN">ADMIN (Administrator)</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
            {loading ? "Creating..." : "Create Account"}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {initialUsers.map((u) => {
              const isSelf = u.id === currentUserId;
              const isLocked =
                u.status === "LOCKED" ||
                (u.lockedUntil !== null && new Date(u.lockedUntil) > new Date());
              return (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <div className="font-mono font-semibold text-slate-900">
                      {u.username} {isSelf && <span className="text-xs text-emerald-700">(you)</span>}
                    </div>
                    {u.email && <div className="text-xs text-slate-500">{u.email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Role for ${u.username}`}
                      disabled={isSelf}
                      value={u.role}
                      onChange={(e) =>
                        updateAccount(u, { role: e.target.value as "STAFF" | "ADMIN" })
                      }
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium disabled:bg-slate-100"
                    >
                      <option value="STAFF">STAFF</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        isLocked
                          ? "bg-amber-50 text-amber-800"
                          : u.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {isLocked ? "LOCKED" : u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {isLocked && (
                        <button
                          type="button"
                          onClick={() => updateAccount(u, { unlock: true })}
                          className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                        >
                          Unlock
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => updateAccount(u, { resetPassword: true })}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Reset Password
                      </button>
                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() =>
                            updateAccount(u, {
                              status: u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                            })
                          }
                          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
