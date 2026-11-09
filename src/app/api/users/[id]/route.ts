import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import { assertSameOrigin, getRequestMeta, handle, ok } from "@/lib/http";
import { staffUserUpdateSchema } from "@/validation/admin";
import { accountService } from "@/server/services/accounts";

const idSchema = z.string().uuid();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requirePermission("user:manage");
    const { id } = await params;
    const validId = idSchema.parse(id);
    const input = staffUserUpdateSchema.parse(await req.json());
    const updated = await accountService.updateStaffOrAdmin(session, validId, input, getRequestMeta(req));
    return ok(updated);
  });
}
