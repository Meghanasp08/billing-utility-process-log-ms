import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'src/auth/auth.module';
import { BrokerageConfiguration, BrokerageConfigurationSchema } from 'src/brokerage_config/schema/brokerage_config.schema';
import { LfiData, LfiDataSchema } from 'src/upload/schemas/lfi-data.schema';
import { TppData, TppDataSchema } from 'src/upload/schemas/tpp-data.schema';
import { ConfigurationController } from './configuration.controller';
import { ConfigurationService } from './configuration.service';
import { ApiDataConfiguration, ApiDataConfigurationSchema } from './schema/api_data.schema';
import { GlobalConfiguration, GlobalConfigurationSchema } from './schema/global_config.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: LfiData.name, schema: LfiDataSchema },
    { name: TppData.name, schema: TppDataSchema },
    { name: GlobalConfiguration.name, schema: GlobalConfigurationSchema },
    { name: ApiDataConfiguration.name, schema: ApiDataConfigurationSchema },
    { name: BrokerageConfiguration.name, schema: BrokerageConfigurationSchema },
  ]),
    AuthModule],
  providers: [ConfigurationService],
  controllers: [ConfigurationController]
})
export class ConfigurationModule { }
