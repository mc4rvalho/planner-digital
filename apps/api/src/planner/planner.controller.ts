import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { DateTime } from "luxon";
import { z } from "zod";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { AuthRequest } from "../auth/controllers/auth.controller";
import { Database } from "../database/database.service";
import { PlannerService } from "./planner.service";
import {
  batchSchema,
  preferencesSchema,
  proposalSchema,
  eventSchema,
} from "./schemas";
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success)
    throw new BadRequestException(r.error.issues.map((i) => i.message));
  return r.data;
}
@Controller()
@UseGuards(JwtAuthGuard)
export class PlannerController {
  constructor(
    private readonly planner: PlannerService,
    private readonly db: Database,
  ) {}
  @Get("events") list(
    @Req() r: AuthRequest,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.planner.list(r.user.id, from, to);
  }
  @Post("events") save(@Req() r: AuthRequest, @Body() b: unknown) {
    return this.planner.save(r.user.id, parse(batchSchema, b).events);
  }
  @Patch("events/:id") update(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: unknown,
  ) {
    return this.planner.update(
      r.user.id,
      id,
      parse(
        z.union([z.object({ completed: z.boolean() }).strict(), eventSchema]),
        b,
      ),
    );
  }
  @Delete("events/:id") remove(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.planner.remove(r.user.id, id);
  }
  @Patch("preferences") async preferences(
    @Req() r: AuthRequest,
    @Body() b: unknown,
  ) {
    const p = parse(preferencesSchema, b);
    await this.db.query("UPDATE users SET preferences=$2 WHERE id=$1", [
      r.user.id,
      JSON.stringify(p),
    ]);
    return p;
  }
  @Post("planner/propose")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async propose(@Req() r: AuthRequest, @Body() b: unknown) {
    const input = parse(proposalSchema, b);
    const from = DateTime.fromISO(input.referenceDate, {
      zone: r.user.preferences.timezone,
    }).startOf("year");
    const existing = await this.planner.list(
      r.user.id,
      from.toISO()!,
      from.plus({ years: 1 }).toISO()!,
    );
    return this.planner.propose(
      input.text,
      input.referenceDate,
      r.user.preferences,
      existing,
    );
  }
}
