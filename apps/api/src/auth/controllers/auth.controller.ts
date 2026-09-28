import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { LocalAuthGuard } from "../guard/local-auth.guard";
import { JwtAuthGuard } from "../guard/jwt-auth.guard";
import { AuthService } from "../services/auth.service";
import { RegisterDto } from "../entities/usuariologin.entity";
import { UserRow } from "../../users/users.service";
export type AuthRequest = { user: Omit<UserRow, "password"> };
@Controller("usuarios")
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post("cadastrar")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  register(@Body() body: RegisterDto) {
    return this.auth.register(body);
  }
  @Post("logar")
  @HttpCode(200)
  @UseGuards(LocalAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  login(@Req() req: AuthRequest) {
    return this.auth.login(req.user);
  }
  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthRequest) {
    return req.user;
  }
}
