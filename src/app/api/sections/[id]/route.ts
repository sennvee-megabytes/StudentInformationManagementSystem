import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import { assertSameOrigin, getRequestMeta, handle, ok } from "@/lib/http";
import { sectionUpdateSchema } from "@/validation/admin";
import { sectionService } from "@/server/services/sections";

const idSchema = z.string().uuid();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requirePermission("section:manage");
    const { id } = await params;
    const validId = idSchema.parse(id);
    const input = sectionUpdateSchema.parse(await req.json());
    const updated = await sectionService.update(session, validId, input, getRequestMeta(req));
    return ok(updated);
  });
}
