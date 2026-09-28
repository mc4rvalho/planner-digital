import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";
@Injectable()
export class Bcrypt {
  criptografarSenha(senha: string): Promise<string> {
    return bcrypt.hash(senha, 12);
  }
  compararSenhas(senhaDigitada: string, senhaBanco: string): Promise<boolean> {
    return bcrypt.compare(senhaDigitada, senhaBanco);
  }
}
