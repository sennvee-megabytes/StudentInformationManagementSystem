import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/http";

export type Permission =
  | "profile:read:self"
  | "profile:update:self"
  | "academic:read:self"
  | "student:read"
  | "student:create"
  | "student:update"
  | "student:delete"
  | "student:restore"
  | "enrollment:manage"
  | "academic:manage"
  | "program:read"
  | "program:manage"
  | "section:read"
  | "section:manage"
  | "section:assign"
  | "account:manage"
  | "user:manage"
  | "report:generate"
  | "audit:read"
  | "dashboard:read";

const STUDENT: Permission[] = ["profile:read:self", "profile:update:self", "academic:read:self"];
const STAFF: Permission[] = [
  "student:read",
  "student:create",
  "student:update",
  "enrollment:manage",
  "academic:manage",
  "program:read",
  "section:read",
  "section:assign",
  "report:generate",
  "dashboard:read",
];
const ADMIN: Permission[] = [
  ...STAFF,
  "student:delete",
  "student:restore",
  "program:manage",
  "section:manage",
  "account:manage",
  "user:manage",
  "audit:read",
];

export const PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  STUDENT: new Set(STUDENT),
  STAFF: new Set(STAFF),
  ADMIN: new Set(ADMIN),
};

export function roleHomePath(role: Role): "/student" | "/staff" | "/admin" {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "STAFF":
      return "/staff";
    case "STUDENT":
      return "/student";
  }
}

export async function requirePermission(permission: Permission) {
  const session = await getSession();
  if (!session) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in.");
  if (session.user.mustChangePassword) {
    throw new HttpError(403, "PASSWORD_CHANGE_REQUIRED", "Change your password to continue.");
  }
  if (!PERMISSIONS[session.user.role].has(permission)) {
    await audit({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "ACCESS_DENIED",
      outcome: "FAILURE",
      metadata: { permission },
    });
    throw new HttpError(403, "FORBIDDEN", "You do not have permission to do that.");
  }
  return session;
}

export async function requirePageRole(allowedRoles: Role[]) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.user.mustChangePassword) {
    redirect("/change-password");
  }
  if (!allowedRoles.includes(session.user.role)) {
    await audit({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "ACCESS_DENIED",
      outcome: "FAILURE",
      metadata: { allowedRoles },
    });
    redirect(roleHomePath(session.user.role));
  }
  return session;
}
