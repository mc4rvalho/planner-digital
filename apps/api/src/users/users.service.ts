import { Injectable } from "@nestjs/common";
import { Database } from "../database/database.service";
export interface UserRow {
  id: string;
  name: string;
  email: string;
  password: string;
  photo: string | null;
  token_version: number;
  preferences: Record<string, string>;
}
@Injectable()
export class UsersService {
  constructor(private readonly db: Database) {}
  async findByEmail(email: string) {
    return (
      await this.db.query<UserRow>("SELECT * FROM users WHERE email=$1", [
        email.trim().toLowerCase(),
      ])
    ).rows[0];
  }
  async findById(id: string) {
    return (
      await this.db.query<UserRow>("SELECT * FROM users WHERE id=$1", [id])
    ).rows[0];
  }
  publicUser(user: UserRow) {
    const { password, ...safe } = user;
    return safe;
  }
}
