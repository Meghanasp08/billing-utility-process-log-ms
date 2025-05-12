import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { User, UserDocument } from '../profile/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/user.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) { }

  async signup(createUserDto: CreateUserDto): Promise<User> {
    const { email, password } = createUserDto;

    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new this.userModel({ ...createUserDto, password: hashedPassword });

    return newUser.save();
  }


  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Invalid credentials');
    }
    let token = await this.getTokens(user, "user");
    await this.userModel.updateOne({ email: email }, { refreshToken: token.refresh_token });
    console.log('token', token);
    return token;
  }

  private signPayload(auth: any, tokenType: string, userType: string) {
    const secretKey =
      tokenType === 'ACCESS'
        ? this.config.get('ACCESS_TOKEN_SECRET')
        : this.config.get('REFRESH_TOKEN_SECRET');

    const expiresIn =
      tokenType === 'ACCESS'
        ? parseInt(this.config.get('ACCESS_TOKEN_EXPIRY') || '3600')
        : parseInt(this.config.get('REFRESH_TOKEN_EXPIRY') || '604800');

    const payload = {
      userId: auth._id,
      email: auth.email,
      userType: userType,
    };

    return this.jwtService.sign(payload, {
      secret: secretKey,
      expiresIn: expiresIn,
    });
  }
  async getUserData(userId: string) {
    return this.userModel.findById(userId).exec();
  }
  async getTokens(auth: any, userType: string) {
    const access_token = this.signPayload(auth, 'ACCESS', userType);
    const refresh_token = this.signPayload(auth, 'REFRESH', userType);

    const expires_in = parseInt(this.config.get('ACCESS_TOKEN_EXPIRY') || '3600');
    const refresh_expires_in = parseInt(this.config.get('REFRESH_TOKEN_EXPIRY') || '604800');

    return {
      access_token,
      refresh_token,
      expires_in,
      refresh_expires_in,
      token_type: 'Bearer',
    };
  }


  async getAccessTokenUsingRefreshToken(
    tokenDto: any,
    req: any,
    userType: string,
  ) {
    const { refresh_token } = tokenDto;
    let decoded;
    try {
      decoded = this.jwtService.verify(refresh_token, {
        secret: this.config.get('REFRESH_TOKEN_SECRET'),
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new BadRequestException('Refresh token has expired');
      }
      throw new BadRequestException('Invalid refresh token');
    }

    if (decoded.userType !== userType) {
      throw new BadRequestException('Invalid token user type');
    }

    const user = await this.userModel.findOne({ _id: decoded.userId });
    if (!user) {
      throw new HttpException(
        'User with this id does not exist',
        HttpStatus.NOT_FOUND,
      );
    }
    const token = await this.getTokens(user, userType);
    await this.userModel.updateOne(
      { _id: decoded.userId },
      { refreshToken: token.refresh_token },
    )
    return token
  }

}
