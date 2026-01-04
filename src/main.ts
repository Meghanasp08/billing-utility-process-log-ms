import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  // Create HTTP application
  const app = await NestFactory.create(AppModule);
  app.use('/upload', express.static(join(__dirname, '..', 'uploads')));
  
  // Setup microservice listener for TCP
  const microservice = app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: process.env.UPLOAD_HOST || 'localhost',
      port: parseInt(process.env.UPLOAD_PORT || '3001'),
    },
  });
  
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

  // Start microservice listener
  await app.startAllMicroservices();
  console.log(` Microservice listening on ${process.env.UPLOAD_HOST || 'localhost'}:${process.env.UPLOAD_PORT || '3001'}`);
  
  // Start HTTP server
  await app.listen(process.env.API_PORT || 3002); 
  console.log(`HTTP API running on port ${process.env.API_PORT || 3002}`);
}
bootstrap();
