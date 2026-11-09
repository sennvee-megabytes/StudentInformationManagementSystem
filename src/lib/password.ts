import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { z } from "zod";

const COST = 12;
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", COST); // equalizes timing for unknown users

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);

export async function verifyPassword(plain: string, hash: string | null | undefined) {
  return bcrypt.compare(plain, hash ?? DUMMY_HASH).then((ok) => ok && !!hash);
}

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .refine((v) => new TextEncoder().encode(v).length <= 72, "Password is too long (72 bytes max).");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export function generateTemporaryPassword(length = 12) {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}
