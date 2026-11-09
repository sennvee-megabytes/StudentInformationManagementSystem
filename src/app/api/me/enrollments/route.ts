import { requirePermission } from "@/lib/authz";
import { handle, ok } from "@/lib/http";
import { profileService } from "@/server/services/profile";

export async function GET() {
  return handle(async () => {
    const session = await requirePermission("profile:read:self");
    const result = await profileService.getOwnEnrollments(session);
    return ok(result);
  });
}
