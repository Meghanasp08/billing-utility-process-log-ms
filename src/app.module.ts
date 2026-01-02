import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BrokerageConfigModule } from './brokerage_config/brokerage_config.module';
import { ConfigurationModule } from './configuration/configuration.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { InvoiceModule } from './invoice/invoice.module';
import { MailModule } from './mail/mail.module';
import { ProfileModule } from './profile/profile.module';
import { RoleModule } from './role/role.module';
import { UploadModule } from './upload/upload.module';
import { UsersModule } from './users/users.module';
@Module({
  imports: [
    // MongooseModule.forRoot(process.env.MONGO_URL || 'mongodb://localhost:27017/defaultdb'),
  //  ====================
//     MongooseModule.forRoot(process.env.MONGO_URL || 'mongodb://localhost:27017/defaultdb', {
//   connectionFactory: (connection) => {
//     connection.on('error', (err) => {
//       console.error('MongoDB connection error:', err);
//     });
//     connection.on('connected', () => {
//       console.log('MongoDB connected successfully');
//     });
//     return connection;
//   },
// }),
// ========

MongooseModule.forRoot(process.env.MONGO_URL || 'mongodb://localhost:27017/defaultdb', {
  retryWrites: false,              // CosmosDB doesn't support retryWrites
  maxPoolSize: 50,                 // Connection pool size
  socketTimeoutMS: 600000,         // 10 minutes - must be longer than maxTimeMS operations
  serverSelectionTimeoutMS: 60000, // Server selection timeout
  connectTimeoutMS: 60000,         // Initial connection timeout
  connectionFactory: (connection) => {
    connection.on('error', (err) => {
      console.error('Database connection error:', err);
    });
    connection.on('connected', () => {
      console.log('Database connected successfully');
    });
    connection.on('disconnected', () => {
      console.log('Database disconnected');
    });
    return connection;
  },
}),
    AuthModule,
    ProfileModule,
    UploadModule,
    MailModule,
    InvoiceModule,
    ConfigurationModule,
    DashboardModule,
    UsersModule,
    RoleModule,
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    ScheduleModule.forRoot(),
    BrokerageConfigModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'), // serve uploads folder
      serveRoot: '/files',                        // accessible at /files/*
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
  exports: [UploadModule],
})
export class AppModule { }
