import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'src/auth/auth.module';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth-guard';
import { Log, LogSchema } from 'src/upload/schemas/billing-log.schema';
import { LfiData, LfiDataSchema } from 'src/upload/schemas/lfi-data.schema';
import { TppData, TppDataSchema } from 'src/upload/schemas/tpp-data.schema';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { User, UserSchema } from './schemas/user.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }, { name: Log.name, schema: LogSchema }, { name: LfiData.name, schema: LfiDataSchema }, { name: TppData.name, schema: TppDataSchema }]), AuthModule],
  providers: [ProfileService, JwtAuthGuard],
  controllers: [ProfileController]
})
export class ProfileModule { }
