import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";
export class UsuarioLogin {
  @IsEmail() @MaxLength(254) usuario!: string;
  @IsString() @MinLength(1) @MaxLength(72) senha!: string;
}
export class RegisterDto {
  @IsEmail() @MaxLength(254) usuario!: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nome!: string;
  @IsString() @MinLength(10) @MaxLength(72) senha!: string;
}
