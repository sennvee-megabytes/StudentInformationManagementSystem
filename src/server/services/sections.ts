import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/http";
import { SectionCreateInput, SectionUpdateInput } from "@/validation/admin";

type Actor = {
  user: { id: string; role: Role };
};

export const sectionService = {
  async list(filters?: {
    programId?: string;
    yearLevel?: number;
    schoolYear?: string;
    activeOnly?: boolean;
  }) {
    const where: Prisma.SectionWhereInput = {
      ...(filters?.programId && { programId: filters.programId }),
      ...(filters?.yearLevel && { yearLevel: filters.yearLevel }),
      ...(filters?.schoolYear && { schoolYear: filters.schoolYear }),
      ...(filters?.activeOnly && { isActive: true }),
    };

    return prisma.section.findMany({
      where,
      orderBy: [{ schoolYear: "desc" }, { yearLevel: "asc" }, { name: "asc" }],
      include: {
        program: { select: { id: true, code: true, name: true } },
        _count: {
          select: {
            students: { where: { deletedAt: null } },
          },
        },
      },
    });
  },

  async create(actor: Actor, input: SectionCreateInput, meta?: { ip?: string; userAgent?: string }) {
    const program = await prisma.program.findUnique({ where: { id: input.programId } });
    if (!program) {
      throw new HttpError(404, "PROGRAM_NOT_FOUND", "Selected program does not exist.");
    }

    const duplicate = await prisma.section.findUnique({
      where: {
        programId_yearLevel_name_schoolYear: {
          programId: input.programId,
          yearLevel: input.yearLevel,
          name: input.name,
          schoolYear: input.schoolYear,
        },
      },
    });
    if (duplicate) {
      throw new HttpError(
        409,
        "DUPLICATE_SECTION",
        `Section ${program.code} ${input.yearLevel}-${input.name} (${input.schoolYear}) already exists.`
      );
    }

    return prisma.$transaction(async (tx) => {
      const section = await tx.section.create({
        data: {
          programId: input.programId,
          yearLevel: input.yearLevel,
          name: input.name,
          schoolYear: input.schoolYear,
          capacity: input.capacity ?? null,
          isActive: true,
        },
        include: {
          program: { select: { id: true, code: true, name: true } },
        },
      });

      await audit(
        {
          actorId: actor.user.id,
          actorRole: actor.user.role,
          action: "SECTION_CREATED",
          entityType: "Section",
          entityId: section.id,
          metadata: {
            programCode: program.code,
            yearLevel: section.yearLevel,
            name: section.name,
            schoolYear: section.schoolYear,
          },
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
        tx
      );

      return section;
    });
  },

  async update(
    actor: Actor,
    id: string,
    input: SectionUpdateInput,
    meta?: { ip?: string; userAgent?: string }
  ) {
    const current = await prisma.section.findUnique({
      where: { id },
      include: {
        _count: { select: { students: { where: { deletedAt: null } } } },
      },
    });
    if (!current) {
      throw new HttpError(404, "NOT_FOUND", "Section not found.");
    }

    if (
      input.capacity !== undefined &&
      input.capacity !== null &&
      input.capacity < current._count.students
    ) {
      throw new HttpError(
        422,
        "CAPACITY_BELOW_ENROLLED",
        `Cannot set capacity to ${input.capacity}: ${current._count.students} students are currently assigned.`
      );
    }

    if (input.name && input.name !== current.name) {
      const duplicate = await prisma.section.findUnique({
        where: {
          programId_yearLevel_name_schoolYear: {
            programId: current.programId,
            yearLevel: current.yearLevel,
            name: input.name,
            schoolYear: current.schoolYear,
          },
        },
      });
      if (duplicate) {
        throw new HttpError(409, "DUPLICATE_SECTION", "Another section with that name already exists.");
      }
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.section.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.capacity !== undefined && { capacity: input.capacity }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
        include: {
          program: { select: { id: true, code: true, name: true } },
        },
      });

      await audit(
        {
          actorId: actor.user.id,
          actorRole: actor.user.role,
          action: "SECTION_UPDATED",
          entityType: "Section",
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
