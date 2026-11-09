import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import { assertSameOrigin, getRequestMeta, handle, ok } from "@/lib/http";
import { studentUpdateSchema } from "@/validation/student";
import { studentService } from "@/server/services/students";

const idSchema = z.string().uuid();

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("student:read");
    const { id } = await params;
    const validId = idSchema.parse(id);
    const student = await studentService.getById(session, validId);
    return ok(student);
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requirePermission("student:update");
    const { id } = await params;
    const validId = idSchema.parse(id);
    const input = studentUpdateSchema.parse(await req.json());
    const updated = await studentService.update(session, validId, input, getRequestMeta(req));
    return ok(updated);
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requirePermission("student:delete");
    const { id } = await params;
    const validId = idSchema.parse(id);
    const result = await studentService.softDelete(session, validId, getRequestMeta(req));
    return ok(result);
  });
}
