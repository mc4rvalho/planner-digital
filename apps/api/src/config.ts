import { config } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";
config({ path: resolve(process.cwd(), "config/.env"), quiet: true });
config({ path: resolve(process.cwd(), "../../config/.env"), quiet: true });
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  FRONTEND_URL: z.string().url(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().email().optional(),
  ),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_FALLBACK_MODEL: z
    .string()
    .regex(/^[a-zA-Z0-9.\-]+$/)
    .default("gemini-3.5-flash-lite"),
  GEMINI_MODEL: z
    .string()
    .regex(/^[a-zA-Z0-9.\-]+$/)
    .default("gemini-3.8-flash"),
});
export const env = schema.parse(process.env);
if (env.JWT_SECRET.startsWith("replace-"))
  throw new Error("Configure um JWT_SECRET aleatório antes de iniciar.");
