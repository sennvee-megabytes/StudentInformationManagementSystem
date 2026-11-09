import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import { assertSameOrigin, getRequestMeta, handle, ok } from "@/lib/http";
import { accountService } from "@/server/services/accounts";

const idSchema = z.string().uuid();

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requirePermission("account:manage");
    const { id } = await params;
    const validId = idSchema.parse(id);
    const result = await accountService.resetStudentPassword(session, validId, getRequestMeta(req));
    return ok(result);
  });
}
