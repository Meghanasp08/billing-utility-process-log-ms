import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User } from './entities/user.entity';
import { UserSchema } from 'src/profile/schemas/user.schema';
import { RoleSchema } from 'src/role/schemas.ts/roles.schema';
import { AuthModule } from 'src/auth/auth.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: 'Role', schema: RoleSchema },
    ]),
    AuthModule,
    MailModule
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule { }
