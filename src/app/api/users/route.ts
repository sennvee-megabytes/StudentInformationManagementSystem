import { requirePermission } from "@/lib/authz";
import { assertSameOrigin, getRequestMeta, handle, ok } from "@/lib/http";
import { staffUserCreateSchema } from "@/validation/admin";
import { accountService } from "@/server/services/accounts";

export async function GET() {
  return handle(async () => {
    await requirePermission("user:manage");
    const users = await accountService.listStaffAndAdmins();
    return ok(users);
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requirePermission("user:manage");
    const input = staffUserCreateSchema.parse(await req.json());
    const created = await accountService.createStaffOrAdmin(session, input, getRequestMeta(req));
    return ok(created, { status: 201 });
  });
}
