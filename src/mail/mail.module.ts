import { Module } from '@nestjs/common';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { MongooseModule } from '@nestjs/mongoose';
import { GlobalConfiguration, GlobalConfigurationSchema } from 'src/configuration/schema/global_config.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: GlobalConfiguration.name, schema: GlobalConfigurationSchema },
  ]),
  ],
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule { }
