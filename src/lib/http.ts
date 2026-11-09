import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors?: Record<string, string[]>
  ) {
    super(message);
  }
}

export function assertSameOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    throw new HttpError(403, "BAD_ORIGIN", "Cross-origin request rejected.");
  }
}

export function getRequestMeta(req: Request): { ip?: string; userAgent?: string } {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() : req.headers.get("x-real-ip") ?? undefined;
  const userAgent = req.headers.get("user-agent") ?? undefined;
  return { ip, userAgent };
}

export const ok = (data: unknown, init?: { status?: number; meta?: unknown }) =>
  NextResponse.json(
    { data, meta: init?.meta },
    { status: init?.status ?? 200, headers: { "Cache-Control": "no-store" } }
  );

export async function handle(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors } },
        { status: err.status }
      );
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input.",
            fieldErrors: err.flatten().fieldErrors as Record<string, string[]>,
          },
        },
        { status: 422 }
      );
    }
    const id = crypto.randomUUID();
    console.error("unhandled", id, err); // never return err details to the client
    return NextResponse.json(
      { error: { code: "INTERNAL", message: `Something went wrong. Ref: ${id}` } },
      { status: 500 }
    );
  }
}
