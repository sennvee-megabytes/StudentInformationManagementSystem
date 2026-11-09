import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  FEATURE_ACADEMIC_RECORDS: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters").optional(),
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  return envSchema.parse(process.env);
}
