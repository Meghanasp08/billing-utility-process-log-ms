import { Module } from '@nestjs/common';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { RoleSchema } from './schemas.ts/roles.schema';
import { AuthModule } from 'src/auth/auth.module';
import { PermissionsSchema } from './schemas.ts/permissions.schemas';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Role', schema: RoleSchema },
      { name: 'Permissions', schema: PermissionsSchema }
    ]),
    AuthModule,
  ],
  controllers: [RoleController],
  providers: [RoleService],
})
export class RoleModule {}
