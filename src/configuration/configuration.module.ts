import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'src/auth/auth.module';
import { LfiData, LfiDataSchema } from 'src/upload/schemas/lfi-data.schema';
import { ConfigurationController } from './configuration.controller';
import { ConfigurationService } from './configuration.service';
import { GlobalConfiguration, GlobalConfigurationSchema } from './schema/global_config.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: LfiData.name, schema: LfiDataSchema }, { name: GlobalConfiguration.name, schema: GlobalConfigurationSchema },]),
    AuthModule],
  providers: [ConfigurationService],
  controllers: [ConfigurationController]
})
export class ConfigurationModule { }
