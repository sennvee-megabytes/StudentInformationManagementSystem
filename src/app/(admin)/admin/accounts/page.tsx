import { requirePageRole } from "@/lib/authz";
import { accountService } from "@/server/services/accounts";
import { StudentAccountsManager } from "@/components/admin/student-accounts-manager";

export default async function AdminStudentAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePageRole(["ADMIN"]);
  const { q } = await searchParams;
  const accounts = await accountService.listStudentAccounts({ q });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Student Accounts</h1>
        <p className="mt-1 text-sm text-slate-600">
          Activate, deactivate, unlock, or issue one-time temporary password resets for student accounts.
        </p>
      </div>
      <StudentAccountsManager accounts={accounts} />
    </div>
  );
}
