import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { assertSameOrigin, getRequestMeta, handle, HttpError, ok } from "@/lib/http";
import { getAssetPresignedUrl, uploadAsset } from "@/lib/storage";

const idSchema = z.string().uuid();
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requirePermission("student:read");
    const { id } = await params;
    const studentId = idSchema.parse(id);

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, photoKey: true, deletedAt: true },
    });
    if (!student || student.deletedAt !== null || !student.photoKey) {
      throw new HttpError(404, "PHOTO_NOT_FOUND", "No student photo or document on file.");
    }

    const signedUrl = await getAssetPresignedUrl(student.photoKey, 3600);
    return ok({ key: student.photoKey, url: signedUrl, expiresIn: 3600 });
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requirePermission("student:update");
    const { id } = await params;
    const studentId = idSchema.parse(id);

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, studentNumber: true, deletedAt: true },
    });
    if (!student || student.deletedAt !== null) {
      throw new HttpError(404, "NOT_FOUND", "Student record not found.");
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new HttpError(422, "VALIDATION_ERROR", "A file upload is required.");
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw new HttpError(
        422,
        "UNSUPPORTED_FILE_TYPE",
        "Only JPEG, PNG, WebP, or PDF files are allowed."
      );
    }

    if (file.size > MAX_BYTES) {
      throw new HttpError(422, "FILE_TOO_LARGE", "File size must not exceed 5 MB.");
    }

    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "application/pdf"
            ? "pdf"
            : "jpg";

    const key = `students/${student.id}/${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    await uploadAsset(key, bytes, file.type);

    const meta = getRequestMeta(req);
    await prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id: student.id },
        data: {
          photoKey: key,
          updatedById: session.user.id,
          version: { increment: 1 },
        },
      });

      await audit(
        {
          actorId: session.user.id,
          actorRole: session.user.role,
          action: "STUDENT_ASSET_UPLOADED",
          entityType: "Student",
          entityId: student.id,
          metadata: { key, contentType: file.type, sizeBytes: file.size },
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
        tx
      );
    });

    const signedUrl = await getAssetPresignedUrl(key, 3600);
    return ok({ key, url: signedUrl }, { status: 201 });
  });
}
