import { getSession } from "@/lib/session";
import { handle, HttpError, ok } from "@/lib/http";

export async function GET() {
  return handle(async () => {
    const session = await getSession();
    if (!session) {
      throw new HttpError(401, "UNAUTHENTICATED", "Please sign in.");
    }
    return ok(session.user);
  });
}
