import { MyLogger } from './logger/logger';
import { CustomExceptionFilter } from './utils/custom-exception-filter';
import { env } from './utils/env';
import { AppModule } from './app.module';

import {
  INestApplication,
  NestApplicationOptions,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';

function getPackageDetails() {
  const packageJson = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'),
  );
  const { name, description, version } = packageJson;
  return { name, description, version };
}

type SwaggerOptions = {
  title: string;
  description: string;
  version: string;
};

function buildSwagger(app: INestApplication, options: SwaggerOptions) {
  const config = new DocumentBuilder()
    .setTitle(options.title)
    .setDescription(options.description)
    .setVersion(options.version)
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  return document;
}

async function appFactory(module: any, options?: NestApplicationOptions) {
  const app = await NestFactory.create(module, {
    ...options,
  });
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new CustomExceptionFilter());

  return app;
}

async function bootstrap() {
  const app = await appFactory(AppModule, {
    bufferLogs: true,
    logger: new MyLogger(),
  });

  // Swagger
  const packageDetails = getPackageDetails();
  const document = buildSwagger(app, {
    title: packageDetails.name,
    description: packageDetails.description,
    version: packageDetails.version,
  });
  SwaggerModule.setup(`/api`, app, document);

  app.startAllMicroservices();
  await app.listen(env.API_PORT);
}
bootstrap();
