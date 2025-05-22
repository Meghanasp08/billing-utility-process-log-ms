import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import * as bcrypt from 'bcryptjs';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  mobile: string;

  @Prop({ type: String })
  refreshToken?: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }) // ✅ Must match MongooseModule registration name
  role: mongoose.Schema.Types.ObjectId;

}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.pre('save', async function (next) {
    const user = this as any;

    // Check if the password field has been modified
    if (!user.isModified('password')) {
        return next();
    }

    try {
        // Generate a salt
        const salt = await bcrypt.genSalt(10);
        // Hash the password using the salt
        user.password = await bcrypt.hash(user.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});