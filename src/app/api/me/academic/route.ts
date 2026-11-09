import { requirePermission } from "@/lib/authz";
import { handle, ok } from "@/lib/http";
import { profileService } from "@/server/services/profile";

export async function GET() {
  return handle(async () => {
    const session = await requirePermission("academic:read:self");
    const records = await profileService.getOwnAcademicRecords(session);
    return ok(records);
  });
}
