import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoleDocument = Role & Document;

@Schema({ collection: 'roles', timestamps: true })
export class Role {
  @Prop()
  name: string;

  @Prop()
  description: string;

  @Prop()
  permissions: any[];

  @Prop({ default: false })
  isDefault: boolean;

  @Prop({ default: false })
  isAdmin: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  createdBy: string;
}

export const RoleSchema = SchemaFactory.createForClass(Role);

