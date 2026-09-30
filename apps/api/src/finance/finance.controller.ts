import { FinanceManagementService } from "./management.service";
import {
  obligationSchema,
  obligationCreateSchema,
  investmentSchema,
} from "./schemas";
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
import { z } from "zod";
import { FinanceService } from "./finance.service";
import { categorySchema, transactionBatch, transactionSchema } from "./schemas";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { AuthRequest } from "../auth/controllers/auth.controller";
function parse<T>(schema: z.ZodType<T>, input: unknown) {
  const r = schema.safeParse(input);
  if (!r.success) throw new BadRequestException("INVALID_INPUT");
  return r.data;
}
@Controller("finance")
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly management: FinanceManagementService,
  ) {}
  @Get("obligations") obligations(@Req() r: AuthRequest) {
    return this.management.obligations(r.user.id);
  }
  @Post("obligations") obligation(@Req() r: AuthRequest, @Body() b: unknown) {
    const input = parse(obligationCreateSchema, b);
    return this.management.obligation(
      r.user.id,
      input,
      undefined,
      input.months,
      input.weeks,
    );
  }
  @Patch("obligations/:id") editObligation(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: unknown,
  ) {
    return this.management.obligation(
      r.user.id,
      parse(obligationSchema, b),
      id,
    );
  }
  @Delete("obligations/:id") removeObligation(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.management.remove(r.user.id, id, "obligation");
  }
  @Get("investments") investments(@Req() r: AuthRequest) {
    return this.management.investments(r.user.id);
  }
  @Post("investments") investment(@Req() r: AuthRequest, @Body() b: unknown) {
    return this.management.investment(r.user.id, parse(investmentSchema, b));
  }
  @Patch("investments/:id") editInvestment(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: unknown,
  ) {
    return this.management.investment(
      r.user.id,
      parse(investmentSchema, b),
      id,
    );
  }
  @Delete("investments/:id") removeInvestment(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.management.remove(r.user.id, id, "investment");
  }
  @Get("obligations/:id/transactions") obligationHistory(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.management.history(r.user.id, id, "obligation");
  }
  @Get("investments/:id/transactions") investmentHistory(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.management.history(r.user.id, id, "investment");
  }
  @Get() dashboard(
    @Req() r: AuthRequest,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.finance.dashboard(r.user.id, from, to);
  }
  @Get("categories") categories(@Req() r: AuthRequest) {
    return this.finance.categories(r.user.id);
  }
  @Post("categories") category(@Req() r: AuthRequest, @Body() b: unknown) {
    return this.finance.category(r.user.id, parse(categorySchema, b));
  }
  @Patch("categories/:id") editCategory(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: unknown,
  ) {
    return this.finance.category(r.user.id, parse(categorySchema, b), id);
  }
  @Delete("categories/:id") removeCategory(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.finance.removeCategory(r.user.id, id);
  }
  @Post("transactions") save(@Req() r: AuthRequest, @Body() b: unknown) {
    return this.finance.save(
      r.user.id,
      parse(transactionBatch, b).transactions,
    );
  }
  @Patch("transactions/:id") update(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: unknown,
  ) {
    return this.finance.save(r.user.id, [parse(transactionSchema, b)], id);
  }
  @Delete("transactions/:id") remove(
    @Req() r: AuthRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.finance.remove(r.user.id, id);
  }
  @Post("propose")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  propose(@Req() r: AuthRequest, @Body() b: unknown) {
    const p = parse(
      z
        .object({
          text: z.string().trim().min(5).max(8000),
          referenceDate: z.iso.date(),
        })
        .strict(),
      b,
    );
    return this.finance.propose(
      r.user.id,
      p.text,
      p.referenceDate,
      r.user.preferences.locale,
    );
  }
}
