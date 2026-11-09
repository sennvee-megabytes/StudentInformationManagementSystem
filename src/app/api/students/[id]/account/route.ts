import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import { assertSameOrigin, getRequestMeta, handle, ok } from "@/lib/http";
import { studentAccountUpdateSchema } from "@/validation/admin";
import { accountService } from "@/server/services/accounts";

const idSchema = z.string().uuid();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requirePermission("account:manage");
    const { id } = await params;
    const validId = idSchema.parse(id);
    const input = studentAccountUpdateSchema.parse(await req.json());
    const updated = await accountService.updateStudentAccount(session, validId, input, getRequestMeta(req));
    return ok(updated);
  });
}
