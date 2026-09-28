import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { env } from "./config";
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  app.getHttpAdapter().getInstance().set("trust proxy", 1);
  app.use(helmet());
  app.enableCors({
    origin: env.FRONTEND_URL,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  await app.listen(env.PORT, "0.0.0.0");
}
bootstrap().catch(() => {
  console.error(
    "API startup failed. Check database and environment configuration.",
  );
  process.exit(1);
});
