import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import { AuthService } from "../services/auth.service";
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly auth: AuthService) {
    super({ usernameField: "usuario", passwordField: "senha" });
  }
  validate(usuario: string, senha: string) {
    return this.auth.validateUser(usuario, senha);
  }
}
