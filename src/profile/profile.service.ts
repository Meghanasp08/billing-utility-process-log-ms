import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class ProfileService {
  constructor( @InjectModel(User.name) private userModel: Model<UserDocument>,) {}

  getProfile() {
    return this.userModel.find().exec();;
  }

  // async uploadFile(file: Express.Multer.File): Promise<string> {
  //   if (!file) {
  //     throw new BadRequestException('No file uploaded');
  //   }

  //   const uploadDir = './uploads';
  //   const fileName = `${Date.now()}-${file.originalname}`;
  //   const filePath = join(uploadDir, fileName);

  //   const fileUrl = `http://localhost:3000/upload/${fileName}`;
  //   return fileUrl;
  // }

}
