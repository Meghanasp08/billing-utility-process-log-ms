import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { UploadModule } from './upload/upload.module';
import { MailModule } from './mail/mail.module';
import { InvoiceModule } from './invoice/invoice.module';
import { ConfigurationModule } from './configuration/configuration.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URL || 'mongodb://localhost:27017/defaultdb'),
    AuthModule,
    ProfileModule,
    UploadModule,
    MailModule,
    InvoiceModule,
    ConfigurationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
