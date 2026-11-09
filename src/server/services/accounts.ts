import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/http";
import { generateTemporaryPassword, hashPassword } from "@/lib/password";
import {
  StaffUserCreateInput,
  StaffUserUpdateInput,
  StudentAccountUpdateInput,
} from "@/validation/admin";

type Actor = {
  user: { id: string; role: Role };
};

const SAFE_USER_SELECT = {
  id: true,
  username: true,
  email: true,
  role: true,
  status: true,
  mustChangePassword: true,
  failedLoginCount: true,
  lockedUntil: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const accountService = {
  async listStaffAndAdmins() {
    return prisma.user.findMany({
      where: { role: { in: ["STAFF", "ADMIN"] } },
      select: SAFE_USER_SELECT,
      orderBy: [{ role: "desc" }, { username: "asc" }],
    });
  },

  async listStudentAccounts(opts?: { q?: string; status?: "ACTIVE" | "INACTIVE" | "LOCKED" }) {
    const q = opts?.q?.trim();
    const where: Prisma.UserWhereInput = {
      role: "STUDENT",
      ...(opts?.status && { status: opts.status }),
      ...(q && {
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          {
            student: {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { studentNumber: { contains: q, mode: "insensitive" } },
              ],
            },
          },
        ],
      }),
    };

    return prisma.user.findMany({
      where,
      select: {
        ...SAFE_USER_SELECT,
        student: {
          select: {
            id: true,
            studentNumber: true,
            firstName: true,
            lastName: true,
            program: { select: { code: true } },
            yearLevel: true,
          },
        },
      },
      orderBy: { username: "asc" },
      take: 100,
    });
  },

  async createStaffOrAdmin(
    actor: Actor,
    input: StaffUserCreateInput,
    meta?: { ip?: string; userAgent?: string }
  ) {
    const username = input.username.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      throw new HttpError(409, "DUPLICATE_USERNAME", `Username "${username}" is already taken.`, {
        username: [`Username "${username}" is already taken.`],
      });
    }

    if (input.email) {
      const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
      if (existingEmail) {
        throw new HttpError(409, "DUPLICATE_EMAIL", "Email address is already in use.", {
          email: ["Email address is already in use."],
        });
      }
    }

    const temporaryPassword = generateTemporaryPassword(12);
    const passwordHash = await hashPassword(temporaryPassword);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          email: input.email ?? null,
          passwordHash,
          role: input.role,
          status: "ACTIVE",
          mustChangePassword: true,
          createdById: actor.user.id,
        },
        select: SAFE_USER_SELECT,
      });

      await audit(
        {
          actorId: actor.user.id,
          actorRole: actor.user.role,
          action: "ACCOUNT_CREATED",
          entityType: "User",
          entityId: user.id,
          metadata: { username: user.username, role: user.role },
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
        tx
      );

      return user;
    });

    return {
      user: created,
      temporaryPassword,
      shownOnce: true as const,
    };
  },

  async updateStaffOrAdmin(
    actor: Actor,
    targetUserId: string,
    input: StaffUserUpdateInput,
    meta?: { ip?: string; userAgent?: string }
  ) {
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target || target.role === "STUDENT") {
      throw new HttpError(404, "NOT_FOUND", "Staff/Admin account not found.");
    }

    // Self-demotion & self-deactivation guard (§5.2 / SEC-13)
    if (target.id === actor.user.id) {
      if (input.role && input.role !== target.role) {
        throw new HttpError(400, "SELF_DEMOTION_FORBIDDEN", "You cannot change your own role.");
      }
      if (input.status === "INACTIVE") {
        throw new HttpError(
          400,
          "SELF_DEACTIVATION_FORBIDDEN",
          "You cannot deactivate your own account."
        );
      }
    }

    // Last active admin guard (§5.2 / SEC-13)
    const isLosingActiveAdmin =
      target.role === "ADMIN" &&
      target.status === "ACTIVE" &&
      (input.role === "STAFF" || input.status === "INACTIVE");

    if (isLosingActiveAdmin) {
      const activeAdmins = await prisma.user.count({
        where: { role: "ADMIN", status: "ACTIVE" },
      });
      if (activeAdmins <= 1) {
        throw new HttpError(
          400,
          "LAST_ADMIN_GUARD",
          "Cannot demote or deactivate the last remaining active administrator."
        );
      }
    }

    let temporaryPassword: string | undefined;
    let passwordHash: string | undefined;
    if (input.resetPassword) {
      temporaryPassword = generateTemporaryPassword(12);
      passwordHash = await hashPassword(temporaryPassword);
    }

    const shouldRevokeSessions =
      input.status === "INACTIVE" ||
      (input.role !== undefined && input.role !== target.role) ||
      input.resetPassword === true;

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: target.id },
        data: {
          ...(input.email !== undefined && { email: input.email }),
          ...(input.role !== undefined && { role: input.role }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.unlock && {
            failedLoginCount: 0,
            lockedUntil: null,
            ...(target.status === "LOCKED" ? { status: "ACTIVE" } : {}),
          }),
          ...(passwordHash && {
            passwordHash,
            mustChangePassword: true,
            failedLoginCount: 0,
            lockedUntil: null,
          }),
        },
        select: SAFE_USER_SELECT,
      });

      if (shouldRevokeSessions) {
        await tx.session.updateMany({
          where: { userId: target.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      if (input.role && input.role !== target.role) {
        await audit(
          {
            actorId: actor.user.id,
            actorRole: actor.user.role,
            action: "ROLE_CHANGED",
            entityType: "User",
            entityId: target.id,
            metadata: { previousRole: target.role, newRole: input.role },
            ip: meta?.ip,
            userAgent: meta?.userAgent,
          },
          tx
        );
      }

      if (input.status && input.status !== target.status) {
        await audit(
          {
            actorId: actor.user.id,
            actorRole: actor.user.role,
            action: input.status === "INACTIVE" ? "ACCOUNT_DEACTIVATED" : "ACCOUNT_ACTIVATED",
            entityType: "User",
            entityId: target.id,
            metadata: { previousStatus: target.status, newStatus: input.status },
            ip: meta?.ip,
            userAgent: meta?.userAgent,
          },
          tx
        );
      }

      if (input.unlock) {
        await audit(
          {
            actorId: actor.user.id,
            actorRole: actor.user.role,
            action: "ACCOUNT_UNLOCKED",
            entityType: "User",
            entityId: target.id,
            ip: meta?.ip,
            userAgent: meta?.userAgent,
          },
          tx
        );
      }

      if (input.resetPassword) {
        await audit(
          {
            actorId: actor.user.id,
            actorRole: actor.user.role,
            action: "ACCOUNT_PASSWORD_RESET",
            entityType: "User",
            entityId: target.id,
            ip: meta?.ip,
            userAgent: meta?.userAgent,
          },
          tx
        );
      }

      return user;
    });

    return {
      user: updated,
      ...(temporaryPassword ? { temporaryPassword, shownOnce: true as const } : {}),
    };
  },

  async updateStudentAccount(
    actor: Actor,
    studentId: string,
    input: StudentAccountUpdateInput,
    meta?: { ip?: string; userAgent?: string }
  ) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    });
    if (!student || !student.user) {
      throw new HttpError(404, "NOT_FOUND", "Student account not found.");
    }

    const target = student.user;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: target.id },
        data: {
          ...(input.status !== undefined && { status: input.status }),
          ...(input.unlock && {
            failedLoginCount: 0,
            lockedUntil: null,
            ...(target.status === "LOCKED" ? { status: "ACTIVE" } : {}),
          }),
        },
        select: SAFE_USER_SELECT,
      });

      if (input.status === "INACTIVE") {
        await tx.session.updateMany({
          where: { userId: target.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      if (input.status && input.status !== target.status) {
        await audit(
          {
            actorId: actor.user.id,
            actorRole: actor.user.role,
            action: input.status === "INACTIVE" ? "ACCOUNT_DEACTIVATED" : "ACCOUNT_ACTIVATED",
            entityType: "User",
            entityId: target.id,
            metadata: { studentId, previousStatus: target.status, newStatus: input.status },
            ip: meta?.ip,
            userAgent: meta?.userAgent,
          },
          tx
        );
      }

      if (input.unlock) {
        await audit(
          {
            actorId: actor.user.id,
            actorRole: actor.user.role,
            action: "ACCOUNT_UNLOCKED",
            entityType: "User",
            entityId: target.id,
            metadata: { studentId },
            ip: meta?.ip,
            userAgent: meta?.userAgent,
          },
          tx
        );
      }

      return updated;
    });
  },

  async resetStudentPassword(
    actor: Actor,
    studentId: string,
    meta?: { ip?: string; userAgent?: string }
  ) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    });
    if (!student || !student.user) {
      throw new HttpError(404, "NOT_FOUND", "Student account not found.");
    }

    const temporaryPassword = generateTemporaryPassword(12);
    const passwordHash = await hashPassword(temporaryPassword);

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: student.user!.id },
        data: {
          passwordHash,
          mustChangePassword: true,
          failedLoginCount: 0,
          lockedUntil: null,
          ...(student.user!.status === "LOCKED" ? { status: "ACTIVE" } : {}),
        },
        select: SAFE_USER_SELECT,
      });

      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await audit(
        {
          actorId: actor.user.id,
          actorRole: actor.user.role,
          action: "ACCOUNT_PASSWORD_RESET",
          entityType: "User",
          entityId: user.id,
          metadata: { studentId },
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
        tx
      );

      return user;
    });

    return {
      user: updated,
      temporaryPassword,
      shownOnce: true as const,
    };
  },
};
