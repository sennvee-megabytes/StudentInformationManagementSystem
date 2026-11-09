import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import { assertSameOrigin, getRequestMeta, handle, ok } from "@/lib/http";
import { academicRecordCreateSchema } from "@/validation/student";
import { studentService } from "@/server/services/students";

const idSchema = z.string().uuid();

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requirePermission("academic:manage");
    const { id } = await params;
    const studentId = idSchema.parse(id);
    const input = academicRecordCreateSchema.parse(await req.json());
    const record = await studentService.addAcademicRecord(session, studentId, input, getRequestMeta(req));
    return ok(record, { status: 201 });
  });
}
