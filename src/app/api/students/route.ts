import { requirePermission } from "@/lib/authz";
import { assertSameOrigin, getRequestMeta, handle, ok } from "@/lib/http";
import { studentCreateSchema, studentListQuerySchema } from "@/validation/student";
import { studentService } from "@/server/services/students";

export async function GET(req: Request) {
  return handle(async () => {
    const session = await requirePermission("student:read");
    const { searchParams } = new URL(req.url);
    const query = studentListQuerySchema.parse(Object.fromEntries(searchParams.entries()));
    const result = await studentService.list(session, query);
    return ok(result.items, { meta: result.meta });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requirePermission("student:create");
    const input = studentCreateSchema.parse(await req.json());
    const created = await studentService.create(session, input, getRequestMeta(req));
    return ok(created, { status: 201 });
  });
}
