import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import { assertSameOrigin, getRequestMeta, handle, ok } from "@/lib/http";
import { studentService } from "@/server/services/students";

const idSchema = z.string().uuid();

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requirePermission("student:restore");
    const { id } = await params;
    const validId = idSchema.parse(id);
    const result = await studentService.restore(session, validId, getRequestMeta(req));
    return ok(result);
  });
}
