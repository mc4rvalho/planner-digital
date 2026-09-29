import {
  BadRequestException,
  Body,
  Controller,
  Injectable,
  Patch,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { createHash, randomBytes } from "node:crypto";
import { createTransport } from "nodemailer";
import { z } from "zod";
import { Database } from "../database/database.service";
import { UsersService, UserRow } from "./users.service";
import { AuthService } from "../auth/services/auth.service";
import { Bcrypt } from "../auth/bcrypt/bcrypt";
import { AuthRequest } from "../auth/controllers/auth.controller";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { env } from "../config";
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) throw new BadRequestException("INVALID_INPUT");
  return r.data;
}
export const passwordSchema = z
  .string()
  .min(10)
  .max(72)
  .refine((v) => Buffer.byteLength(v) <= 72);
export function validPhoto(value: string) {
  const match =
    /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 180000 || buffer.length < 12) return false;
  return match[1] === "png"
    ? buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : match[1] === "jpeg"
      ? buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
      : buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP";
}
@Injectable()
export class ResetMailer {
  async send(email: string, token: string) {
    if (!env.SMTP_HOST || !env.SMTP_FROM)
      throw new ServiceUnavailableException("EMAIL_NOT_CONFIGURED");
    const transport = createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE === "true",
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });
    const url = new URL(env.FRONTEND_URL);
    url.hash = "reset=" + token;
    try {
      await transport.sendMail({
        from: env.SMTP_FROM,
        to: email,
        subject: "Tempo · Redefinir senha / Reset password",
        text: `Redefina sua senha / Reset your password:
${url}

Este link expira em 30 minutos e só pode ser usado uma vez. Se você não solicitou, ignore esta mensagem. / This link expires in 30 minutes and can only be used once. If you did not request it, ignore this message.`,
      });
    } catch {
      throw new ServiceUnavailableException("EMAIL_UNAVAILABLE");
    }
  }
}
@Controller("account")
export class AccountController {
  constructor(
    private readonly db: Database,
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly bcrypt: Bcrypt,
    private readonly mailer: ResetMailer,
  ) {}
  @Patch("profile")
  @UseGuards(JwtAuthGuard)
  async profile(@Req() req: AuthRequest, @Body() body: unknown) {
    const p = parse(
      z
        .object({
          name: z.string().trim().min(2).max(80),
          photo: z.string().max(250000).refine(validPhoto).nullable(),
        })
        .strict(),
      body,
    );
    const result = await this.db.query<UserRow>(
      "UPDATE users SET name=$2,photo=$3 WHERE id=$1 RETURNING *",
      [req.user.id, p.name, p.photo],
    );
    return this.users.publicUser(result.rows[0]);
  }
  @Post("password")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async password(@Req() req: AuthRequest, @Body() body: unknown) {
    const p = parse(
      z
        .object({
          currentPassword: z.string().min(1).max(72),
          newPassword: passwordSchema,
        })
        .strict(),
      body,
    );
    const client = await this.db.pool.connect();
    try {
      await client.query("BEGIN");
      const user = (
        await client.query<UserRow>(
          "SELECT * FROM users WHERE id=$1 FOR UPDATE",
          [req.user.id],
        )
      ).rows[0];
      if (
        user.token_version !== req.user.token_version ||
        !(await this.bcrypt.compararSenhas(p.currentPassword, user.password))
      )
        throw new UnauthorizedException("CURRENT_PASSWORD_INVALID");
      const hash = await this.bcrypt.criptografarSenha(p.newPassword);
      const next = (
        await client.query<UserRow>(
          "UPDATE users SET password=$2,token_version=token_version+1 WHERE id=$1 RETURNING *",
          [user.id, hash],
        )
      ).rows[0];
      await client.query("DELETE FROM password_resets WHERE user_id=$1", [
        user.id,
      ]);
      await client.query("COMMIT");
      return this.auth.login(this.users.publicUser(next));
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  @Post("forgot-password")
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async forgot(@Body() body: unknown) {
    const { email } = parse(
      z.object({ email: z.string().email().max(254) }).strict(),
      body,
    );
    if (!env.SMTP_HOST || !env.SMTP_FROM)
      throw new ServiceUnavailableException("EMAIL_NOT_CONFIGURED");
    const user = await this.users.findByEmail(email);
    if (user) {
      const token = randomBytes(32).toString("hex");
      const hash = createHash("sha256").update(token).digest("hex");
      await this.db.query("DELETE FROM password_resets WHERE expires_at<now()");
      await this.db.query(
        "INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 minutes')",
        [hash, user.id],
      );
      try {
        await this.mailer.send(user.email, token);
      } catch (e) {
        await this.db.query("DELETE FROM password_resets WHERE token_hash=$1", [
          hash,
        ]);
        throw e;
      }
    }
    return { message: "IF_ACCOUNT_EXISTS_EMAIL_SENT" };
  }
  @Post("reset-password")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async reset(@Body() body: unknown) {
    const p = parse(
      z
        .object({
          token: z.string().regex(/^[a-f0-9]{64}$/),
          newPassword: passwordSchema,
        })
        .strict(),
      body,
    );
    const hash = createHash("sha256").update(p.token).digest("hex");
    const client = await this.db.pool.connect();
    try {
      await client.query("BEGIN");
      const candidate = (
        await client.query(
          "SELECT user_id FROM password_resets WHERE token_hash=$1 AND expires_at>now()",
          [hash],
        )
      ).rows[0];
      if (!candidate) throw new BadRequestException("RESET_INVALID");
      await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        candidate.user_id,
      ]);
      const used = await client.query(
        "DELETE FROM password_resets WHERE token_hash=$1 AND expires_at>now() RETURNING user_id",
        [hash],
      );
      if (!used.rowCount) throw new BadRequestException("RESET_INVALID");
      const password = await this.bcrypt.criptografarSenha(p.newPassword);
      await client.query(
        "UPDATE users SET password=$2,token_version=token_version+1 WHERE id=$1",
        [candidate.user_id, password],
      );
      await client.query("DELETE FROM password_resets WHERE user_id=$1", [
        candidate.user_id,
      ]);
      await client.query("COMMIT");
      return { success: true };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}
