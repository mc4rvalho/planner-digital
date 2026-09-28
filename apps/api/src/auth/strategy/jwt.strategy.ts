import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { jwtConstants } from "../constants/constants";
import { UsersService } from "../../users/users.service";
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
      algorithms: ["HS256"],
      issuer: "planner-digital",
      audience: "planner-app",
    });
  }
  async validate(payload: { sub?: string }) {
    if (!payload.sub || !/^[0-9a-f-]{36}$/i.test(payload.sub))
      throw new UnauthorizedException();
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return this.users.publicUser(user);
  }
}
