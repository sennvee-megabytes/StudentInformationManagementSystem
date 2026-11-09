import { requirePageRole } from "@/lib/authz";
import { accountService } from "@/server/services/accounts";
import { StaffManager } from "@/components/admin/staff-manager";

export default async function AdminStaffPage() {
  const session = await requirePageRole(["ADMIN"]);
  const users = await accountService.listStaffAndAdmins();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Staff & Administrator Accounts</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage registrar and administrator accounts, role permissions, lockouts, and password resets.
        </p>
      </div>
      <StaffManager currentUserId={session.user.id} initialUsers={users} />
    </div>
  );
}
