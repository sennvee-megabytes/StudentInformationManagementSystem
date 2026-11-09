import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import { assertSameOrigin, getRequestMeta, handle, ok } from "@/lib/http";
import { academicRecordUpdateSchema } from "@/validation/student";
import { studentService } from "@/server/services/students";

const idSchema = z.string().uuid();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; recordId: string }> }
) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requirePermission("academic:manage");
    const { id, recordId } = await params;
    const studentId = idSchema.parse(id);
    const validRecordId = idSchema.parse(recordId);
    const input = academicRecordUpdateSchema.parse(await req.json());
    const updated = await studentService.updateAcademicRecord(
      session,
      studentId,
      validRecordId,
      input,
      getRequestMeta(req)
    );
    return ok(updated);
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; recordId: string }> }
) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requirePermission("academic:manage");
    const { id, recordId } = await params;
    const studentId = idSchema.parse(id);
    const validRecordId = idSchema.parse(recordId);
    const result = await studentService.deleteAcademicRecord(
      session,
      studentId,
      validRecordId,
      getRequestMeta(req)
    );
    return ok(result);
  });
}
