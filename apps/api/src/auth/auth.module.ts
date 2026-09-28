import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { jwtConstants } from "./constants/constants";
import { Bcrypt } from "./bcrypt/bcrypt";
import { AuthController } from "./controllers/auth.controller";
import { AuthService } from "./services/auth.service";
import { LocalStrategy } from "./strategy/local.strategy";
import { JwtStrategy } from "./strategy/jwt.strategy";
import { UsersService } from "../users/users.service";
@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: {
        expiresIn: "1h",
        algorithm: "HS256",
        issuer: "planner-digital",
        audience: "planner-app",
      },
    }),
  ],
  controllers: [AuthController],
  providers: [Bcrypt, AuthService, LocalStrategy, JwtStrategy, UsersService],
  exports: [Bcrypt, UsersService],
})
export class AuthModule {}
