import { assertSameOrigin, getRequestMeta, handle, ok } from "@/lib/http";
import { changePasswordSchema } from "@/validation/auth";
import { authService } from "@/server/services/auth";

export async function PATCH(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const input = changePasswordSchema.parse(await req.json());
    const result = await authService.changePassword(input, getRequestMeta(req));
    return ok(result);
  });
}
