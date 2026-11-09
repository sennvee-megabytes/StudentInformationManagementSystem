import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/http";
import { ProgramCreateInput, ProgramUpdateInput } from "@/validation/admin";

type Actor = {
  user: { id: string; role: Role };
};

export const programService = {
  async list(opts?: { activeOnly?: boolean }) {
    return prisma.program.findMany({
      where: opts?.activeOnly ? { isActive: true } : undefined,
      orderBy: { code: "asc" },
      include: {
        _count: {
          select: {
            students: { where: { deletedAt: null } },
            sections: true,
          },
        },
      },
    });
  },

  async create(actor: Actor, input: ProgramCreateInput, meta?: { ip?: string; userAgent?: string }) {
    const existing = await prisma.program.findUnique({ where: { code: input.code } });
    if (existing) {
      throw new HttpError(409, "DUPLICATE_PROGRAM_CODE", `Program code "${input.code}" already exists.`, {
        code: [`Program code "${input.code}" already exists.`],
      });
    }

    return prisma.$transaction(async (tx) => {
      const program = await tx.program.create({
        data: {
          code: input.code,
          name: input.name,
          description: input.description ?? null,
          isActive: true,
        },
      });

      await audit(
        {
          actorId: actor.user.id,
          actorRole: actor.user.role,
          action: "PROGRAM_CREATED",
          entityType: "Program",
          entityId: program.id,
          metadata: { code: program.code, name: program.name },
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
        tx
      );

      return program;
    });
  },

  async update(
    actor: Actor,
    id: string,
    input: ProgramUpdateInput,
    meta?: { ip?: string; userAgent?: string }
  ) {
    const current = await prisma.program.findUnique({ where: { id } });
    if (!current) {
      throw new HttpError(404, "NOT_FOUND", "Program not found.");
    }

    if (input.code && input.code !== current.code) {
      const collision = await prisma.program.findUnique({ where: { code: input.code } });
      if (collision) {
        throw new HttpError(409, "DUPLICATE_PROGRAM_CODE", `Program code "${input.code}" already exists.`, {
          code: [`Program code "${input.code}" already exists.`],
        });
      }
    }

    const data: Prisma.ProgramUpdateInput = {
      ...(input.code !== undefined && { code: input.code }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    };

    return prisma.$transaction(async (tx) => {
      const updated = await tx.program.update({
        where: { id },
        data,
      });

      await audit(
        {
          actorId: actor.user.id,
          actorRole: actor.user.role,
          action: "PROGRAM_UPDATED",
          entityType: "Program",
          entityId: updated.id,
          metadata: { changedFields: Object.keys(input) },
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
        tx
      );

      return updated;
    });
  },
};
