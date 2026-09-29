import { FinanceController } from "./finance/finance.controller";
import { FinanceService } from "./finance/finance.service";
import { Controller, Get, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { Database } from "./database/database.service";
import { PlannerController } from "./planner/planner.controller";
import { PlannerService } from "./planner/planner.service";
@Controller("health")
class HealthController {
  constructor(private readonly db: Database) {}
  @Get() async health() {
    await this.db.query("SELECT 1");
    return { status: "ok" };
  }
}
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
  ],
  controllers: [HealthController, PlannerController, FinanceController],
  providers: [
    FinanceService,
    PlannerService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
