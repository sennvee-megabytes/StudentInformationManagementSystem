import { requirePermission } from "@/lib/authz";
import { handle, ok } from "@/lib/http";
import { dashboardService } from "@/server/services/dashboard";

export async function GET() {
  return handle(async () => {
    await requirePermission("dashboard:read");
    const stats = await dashboardService.getAdminStats();
    return ok(stats);
  });
}
