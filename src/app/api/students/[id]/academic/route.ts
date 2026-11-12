import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import { assertSameOrigin, getRequestMeta, handle, ok } from "@/lib/http";
import { schoolYearSchema } from "@/validation/admin";
import { academicRecordCreateSchema } from "@/validation/student";
import { studentService } from "@/server/services/students";

const idSchema = z.string().uuid();

const loadCurriculumSchema = z
  .object({
    loadCurriculum: z.literal(true),
    schoolYear: schoolYearSchema,
    semester: z.enum(["FIRST", "SECOND", "MIDYEAR"]),
  })
  .strict();

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requirePermission("academic:manage");
    const { id } = await params;
    const studentId = idSchema.parse(id);
    const body = await req.json();

    if (body && typeof body === "object" && "loadCurriculum" in body && body.loadCurriculum === true) {
      const input = loadCurriculumSchema.parse(body);
      const res = await studentService.loadCurriculumSubjects(
        session,
        studentId,
        { schoolYear: input.schoolYear, semester: input.semester },
        getRequestMeta(req)
      );
      return ok(res, { status: 201 });
    }

    const input = academicRecordCreateSchema.parse(body);
    const record = await studentService.addAcademicRecord(
      session,
      studentId,
      input,
      getRequestMeta(req)
    );
    return ok(record, { status: 201 });
  });
}
