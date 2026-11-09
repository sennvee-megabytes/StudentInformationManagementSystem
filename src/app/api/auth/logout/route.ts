import { assertSameOrigin, getRequestMeta, handle, ok } from "@/lib/http";
import { authService } from "@/server/services/auth";

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    await authService.logout(getRequestMeta(req));
    return ok({ loggedOut: true });
  });
}
