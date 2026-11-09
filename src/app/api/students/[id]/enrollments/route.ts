import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import { assertSameOrigin, getRequestMeta, handle, ok } from "@/lib/http";
import { enrollmentUpsertSchema } from "@/validation/student";
import { studentService } from "@/server/services/students";

const idSchema = z.string().uuid();

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requirePermission("enrollment:manage");
    const { id } = await params;
    const validId = idSchema.parse(id);
    const input = enrollmentUpsertSchema.parse(await req.json());
    const result = await studentService.upsertEnrollment(session, validId, input, getRequestMeta(req));
    return ok(result, { status: 201 });
  });
}
