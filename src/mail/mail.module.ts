import { Module } from '@nestjs/common';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { MongooseModule } from '@nestjs/mongoose';
import { GlobalConfiguration, GlobalConfigurationSchema } from 'src/configuration/schema/global_config.schema';
import { User, UserSchema } from 'src/profile/schemas/user.schema';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [MongooseModule.forFeature([
    { name: GlobalConfiguration.name, schema: GlobalConfigurationSchema },
    { name: User.name, schema: UserSchema },
  ]),
  JwtModule.registerAsync({
    useFactory: () => ({
      secret: process.env.JWT_SECRET || 'defaultSecret',
      signOptions: { expiresIn: '1h' },
    }),
  }),
  ],
  controllers: [MailController],
  providers: [MailService],
  exports: [JwtModule, MailService],
})
export class MailModule { }
