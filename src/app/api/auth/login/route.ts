import { assertSameOrigin, getRequestMeta, handle, ok } from "@/lib/http";
import { loginSchema } from "@/validation/auth";
import { authService } from "@/server/services/auth";

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const input = loginSchema.parse(await req.json());
    const user = await authService.login(input, getRequestMeta(req));
    return ok(user);
  });
}
