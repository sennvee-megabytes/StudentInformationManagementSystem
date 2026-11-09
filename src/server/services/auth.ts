import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  createSession,
  destroyCurrentSession,
  getSession,
  revokeAllSessions,
} from "@/lib/session";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/http";
import {
  ChangePasswordInput,
  LoginInput,
  validatePasswordAgainstUsername,
} from "@/validation/auth";

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const GENERIC_LOGIN_ERROR = "Invalid username or password.";

export type RequestMeta = {
  ip?: string;
  userAgent?: string;
};

export const authService = {
  async login(input: LoginInput, meta: RequestMeta) {
    const username = input.username.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { username },
    });

    // Always perform a bcrypt comparison (against a dummy hash if user is missing) to equalize timing (S1/S2).
    const passwordMatches = await verifyPassword(input.password, user?.passwordHash);

    if (!user) {
      await audit({
        action: "LOGIN_FAILURE",
        outcome: "FAILURE",
        metadata: { reason: "unknown_user", attemptedUsername: username },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new HttpError(401, "INVALID_CREDENTIALS", GENERIC_LOGIN_ERROR);
    }

    const now = new Date();
    const isCurrentlyLocked =
      user.status === "LOCKED" || (user.lockedUntil !== null && user.lockedUntil > now);

    if (user.status === "INACTIVE" || isCurrentlyLocked) {
      await audit({
        actorId: user.id,
        actorRole: user.role,
        action: "LOGIN_FAILURE",
        entityType: "User",
        entityId: user.id,
        outcome: "FAILURE",
        metadata: {
          reason: user.status === "INACTIVE" ? "account_inactive" : "account_locked",
        },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new HttpError(401, "INVALID_CREDENTIALS", GENERIC_LOGIN_ERROR);
    }

    if (!passwordMatches) {
      const nextCount = user.failedLoginCount + 1;
      const shouldLock = nextCount >= MAX_FAILED_LOGINS;
      const lockedUntil = shouldLock ? new Date(now.getTime() + LOCKOUT_DURATION_MS) : null;

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: nextCount,
            ...(shouldLock ? { lockedUntil } : {}),
          },
        });

        await audit(
          {
            actorId: user.id,
            actorRole: user.role,
            action: "LOGIN_FAILURE",
            entityType: "User",
            entityId: user.id,
            outcome: "FAILURE",
            metadata: { failedLoginCount: nextCount },
            ip: meta.ip,
            userAgent: meta.userAgent,
          },
          tx
        );

        if (shouldLock) {
          await audit(
            {
              actorId: user.id,
              actorRole: user.role,
              action: "ACCOUNT_LOCKED",
              entityType: "User",
              entityId: user.id,
              outcome: "FAILURE",
              metadata: { failedLoginCount: nextCount, lockedUntil: lockedUntil?.toISOString() },
              ip: meta.ip,
              userAgent: meta.userAgent,
            },
            tx
          );
        }
      });

      throw new HttpError(401, "INVALID_CREDENTIALS", GENERIC_LOGIN_ERROR);
    }

    // Password is valid and account is active & unlocked:
    // Rotate any existing session token in the current browser before issuing a new one.
    await destroyCurrentSession();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: now,
      },
    });

    await createSession(user.id, meta);

    await audit({
      actorId: user.id,
      actorRole: user.role,
      action: "LOGIN_SUCCESS",
      entityType: "User",
      entityId: user.id,
      outcome: "SUCCESS",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
  },

  async logout(meta: RequestMeta) {
    const session = await getSession();
    await destroyCurrentSession();
    if (session) {
      await audit({
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "LOGOUT",
        entityType: "User",
        entityId: session.user.id,
        outcome: "SUCCESS",
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    }
  },

  async changePassword(input: ChangePasswordInput, meta: RequestMeta) {
    const session = await getSession();
    if (!session) {
      throw new HttpError(401, "UNAUTHENTICATED", "Please sign in.");
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user || user.status !== "ACTIVE") {
      throw new HttpError(401, "UNAUTHENTICATED", "Please sign in.");
    }

    const validCurrent = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!validCurrent) {
      await audit({
        actorId: user.id,
        actorRole: user.role,
        action: "PASSWORD_CHANGE_FAILURE",
        entityType: "User",
        entityId: user.id,
        outcome: "FAILURE",
        metadata: { reason: "invalid_current_password" },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new HttpError(400, "INVALID_CURRENT_PASSWORD", "Current password is incorrect.", {
        currentPassword: ["Current password is incorrect."],
      });
    }

    const policyError = validatePasswordAgainstUsername(input.newPassword, user.username);
    if (policyError) {
      throw new HttpError(422, "VALIDATION_ERROR", policyError, {
        newPassword: [policyError],
      });
    }

    const newHash = await hashPassword(input.newPassword);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newHash,
          mustChangePassword: false,
          passwordChangedAt: now,
        },
      });

      await audit(
        {
          actorId: user.id,
          actorRole: user.role,
          action: "PASSWORD_CHANGED",
          entityType: "User",
          entityId: user.id,
          outcome: "SUCCESS",
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx
      );
    });

    // Revoke all other active sessions for this user (S7)
    await revokeAllSessions(user.id, session.sessionId);

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      mustChangePassword: false,
    };
  },
};
