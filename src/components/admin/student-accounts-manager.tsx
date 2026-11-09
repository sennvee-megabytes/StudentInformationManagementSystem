"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TempPasswordDialog } from "@/components/admin/temp-password-dialog";

type StudentAccountRow = {
  id: string;
  username: string;
  status: "ACTIVE" | "INACTIVE" | "LOCKED";
  mustChangePassword: boolean;
  lockedUntil: string | Date | null;
  lastLoginAt: string | Date | null;
  student: {
    id: string;
    studentNumber: string;
    firstName: string;
    lastName: string;
    program: { code: string };
    yearLevel: number;
  } | null;
};

export function StudentAccountsManager({ accounts }: { accounts: StudentAccountRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [issuedCreds, setIssuedCreds] = useState<{
    username: string;
    temporaryPassword: string;
  } | null>(null);

  async function updateStatus(studentId: string, patch: { status?: "ACTIVE" | "INACTIVE"; unlock?: boolean }) {
    setError(null);
    const res = await fetch(`/api/students/${studentId}/account`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error?.message ?? "Failed to update student account.");
      return;
    }
    router.refresh();
  }

  async function resetPassword(studentId: string, username: string) {
    setError(null);
    const res = await fetch(`/api/students/${studentId}/account/reset`, {
      method: "POST",
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error?.message ?? "Failed to reset password.");
      return;
    }
    setIssuedCreds({
      username,
      temporaryPassword: body.data.temporaryPassword,
    });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {issuedCreds && (
        <TempPasswordDialog
          title="Student Password Reset"
          username={issuedCreds.username}
          temporaryPassword={issuedCreds.temporaryPassword}
          onClose={() => setIssuedCreds(null)}
        />
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Student No. / Username</th>
              <th className="px-4 py-3">Student Name</th>
              <th className="px-4 py-3">Program & Year</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  No student accounts found.
                </td>
              </tr>
            ) : (
              accounts.map((acc) => {
                const isLocked =
                  acc.status === "LOCKED" ||
                  (acc.lockedUntil !== null && new Date(acc.lockedUntil) > new Date());
                const studentId = acc.student?.id;

                return (
                  <tr key={acc.id}>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                      {acc.username}
                    </td>
                    <td className="px-4 py-3 text-slate-800">
                      {acc.student
                        ? `${acc.student.lastName}, ${acc.student.firstName}`
                        : "Unlinked account"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {acc.student ? `${acc.student.program.code} – Year ${acc.student.yearLevel}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          isLocked
                            ? "bg-amber-50 text-amber-800"
                            : acc.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isLocked ? "LOCKED" : acc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {studentId && (
                        <div className="inline-flex items-center gap-1.5">
                          {isLocked && (
                            <button
                              type="button"
                              onClick={() => updateStatus(studentId, { unlock: true })}
                              className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                            >
                              Unlock
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => resetPassword(studentId, acc.username)}
                            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Reset Password
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateStatus(studentId, {
                                status: acc.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                              })
                            }
                            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            {acc.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
