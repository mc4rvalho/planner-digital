import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "node:crypto";
import { Bcrypt } from "../bcrypt/bcrypt";
import { RegisterDto } from "../entities/usuariologin.entity";
import { UsersService, UserRow } from "../../users/users.service";
import { Database } from "../../database/database.service";
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly bcrypt: Bcrypt,
    private readonly db: Database,
  ) {}
  async validateUser(email: string, password: string) {
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      Buffer.byteLength(password) > 72
    )
      throw new UnauthorizedException("Invalid credentials");
    const user = await this.users.findByEmail(email);
    // Always perform a bcrypt comparison to reduce account enumeration through timing.
    const dummy =
      "$2b$12$C6UzMDM.H6dfI/f/IKcEe.9aDr.fFBpnR1VoHBZoCnGLZLcRC0gtu";
    const match = await this.bcrypt.compararSenhas(
      password,
      user?.password ?? dummy,
    );
    if (!user || !match) throw new UnauthorizedException("Invalid credentials");
    return this.users.publicUser(user);
  }
  async register(input: RegisterDto) {
    if (Buffer.byteLength(input.senha) > 72)
      throw new BadRequestException("Password exceeds 72 bytes");
    const hash = await this.bcrypt.criptografarSenha(input.senha);
    try {
      const result = await this.db.query<UserRow>(
        "INSERT INTO users(id,name,email,password) VALUES($1,$2,$3,$4) RETURNING *",
        [
          randomUUID(),
          input.nome.trim(),
          input.usuario.trim().toLowerCase(),
          hash,
        ],
      );
      return this.login(this.users.publicUser(result.rows[0]));
    } catch (e) {
      if ((e as { code?: string }).code === "23505")
        throw new ConflictException("Unable to register this email");
      throw e;
    }
  }
  login(user: Omit<UserRow, "password">) {
    return {
      user,
      accessToken: this.jwt.sign({ sub: user.id }),
      expiresIn: 3600,
    };
  }
}
