import { requirePermission } from "@/lib/authz";
import { assertSameOrigin, getRequestMeta, handle, ok } from "@/lib/http";
import { sectionCreateSchema } from "@/validation/admin";
import { sectionService } from "@/server/services/sections";

export async function GET(req: Request) {
  return handle(async () => {
    await requirePermission("section:read");
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("programId") ?? undefined;
    const yearLevelParam = searchParams.get("yearLevel");
    const yearLevel = yearLevelParam ? Number(yearLevelParam) : undefined;
    const schoolYear = searchParams.get("schoolYear") ?? undefined;
    const activeOnly = searchParams.get("activeOnly") === "true";

    const sections = await sectionService.list({
      programId,
      yearLevel: yearLevel && !Number.isNaN(yearLevel) ? yearLevel : undefined,
      schoolYear,
      activeOnly,
    });
    return ok(sections);
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requirePermission("section:manage");
    const input = sectionCreateSchema.parse(await req.json());
    const section = await sectionService.create(session, input, getRequestMeta(req));
    return ok(section, { status: 201 });
  });
}
