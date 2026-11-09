import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import { assertSameOrigin, getRequestMeta, handle, ok } from "@/lib/http";
import { programUpdateSchema } from "@/validation/admin";
import { programService } from "@/server/services/programs";

const idSchema = z.string().uuid();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requirePermission("program:manage");
    const { id } = await params;
    const validId = idSchema.parse(id);
    const input = programUpdateSchema.parse(await req.json());
    const updated = await programService.update(session, validId, input, getRequestMeta(req));
    return ok(updated);
  });
}
