import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const isProd = process.env.NODE_ENV === "production";
export const COOKIE_NAME = isProd ? "__Host-sims_sid" : "sims_sid";
const IDLE_MS = 20 * 60 * 1000;
const ABSOLUTE_MS = 8 * 60 * 60 * 1000;
const TOUCH_MS = 60 * 1000;

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export async function createSession(userId: string, meta: { ip?: string; userAgent?: string }) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 255),
      lastSeenAt: new Date(now),
      expiresAt: new Date(now + ABSOLUTE_MS),
    },
  });
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: ABSOLUTE_MS / 1000,
  });
}

// Read-only resolver (safe in Server Components: it never sets cookies).
export const getSession = cache(async () => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const s = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          role: true,
          status: true,
          mustChangePassword: true,
        },
      },
    },
  });
  if (!s || s.revokedAt) return null;

  const now = Date.now();
  const expired = s.expiresAt.getTime() <= now || now - s.lastSeenAt.getTime() > IDLE_MS;
  if (expired) {
    await prisma.session.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
    await audit({ actorId: s.user.id, actorRole: s.user.role, action: "SESSION_TIMEOUT" }); // brief A1
    return null;
  }
  if (s.user.status !== "ACTIVE") return null;

  if (now - s.lastSeenAt.getTime() > TOUCH_MS) {
    await prisma.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date(now) } });
  }
  return { sessionId: s.id, user: s.user };
});

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  jar.delete(COOKIE_NAME);
}

export const revokeAllSessions = (userId: string, exceptSessionId?: string) =>
  prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
