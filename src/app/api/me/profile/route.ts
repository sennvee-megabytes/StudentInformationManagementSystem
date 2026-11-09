import { requirePermission } from "@/lib/authz";
import { assertSameOrigin, getRequestMeta, handle, ok } from "@/lib/http";
import { selfUpdateSchema } from "@/validation/student";
import { profileService } from "@/server/services/profile";

export async function GET() {
  return handle(async () => {
    const session = await requirePermission("profile:read:self");
    const profile = await profileService.getOwnProfile(session);
    return ok(profile);
  });
}

export async function PATCH(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requirePermission("profile:update:self");
    const input = selfUpdateSchema.parse(await req.json());
    const updated = await profileService.updateOwnProfile(session, input, getRequestMeta(req));
    return ok(updated);
  });
}
