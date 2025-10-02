import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use('/upload', express.static(join(__dirname, '..', 'uploads')));
  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Mercury Billing API')
    .setDescription('The API description for authentication and profile management')
    .setVersion('1.0')
    .addBearerAuth() // Enable bearer token authentication
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  app.enableCors({
    allowedHeaders: '*',
    origin: '*',
    credentials: true
  });

  await app.listen(process.env.API_PORT || 3000);
}
bootstrap();
