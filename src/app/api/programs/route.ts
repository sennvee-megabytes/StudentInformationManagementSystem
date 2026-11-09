import { requirePermission } from "@/lib/authz";
import { assertSameOrigin, getRequestMeta, handle, ok } from "@/lib/http";
import { programCreateSchema } from "@/validation/admin";
import { programService } from "@/server/services/programs";

export async function GET(req: Request) {
  return handle(async () => {
    await requirePermission("program:read");
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("activeOnly") === "true";
    const programs = await programService.list({ activeOnly });
    return ok(programs);
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requirePermission("program:manage");
    const input = programCreateSchema.parse(await req.json());
    const program = await programService.create(session, input, getRequestMeta(req));
    return ok(program, { status: 201 });
  });
}
