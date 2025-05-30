import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { User, UserDocument } from '../profile/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto, ForgotPasswordSendOtpDTO, ForgotPasswordVerifyOtpDTO, VerifyTokenAndChangePasswordDTO } from './dto/user.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel('Role') private readonly rolesModel: Model<any>,
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

    if (!user.isVerified) {
      throw new BadRequestException('Please activate your account first.');
    }

    if (user?.status == 3) {
      throw new BadRequestException('Please activate your account first.');
    }

    if (user?.status == 5) {
      throw new BadRequestException('User is revoked by the Admin.Please contact your admin');
    }

    if (user?.status == 2) {
      throw new BadRequestException('User is In-Active.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Invalid credentials');
    }
    let token = await this.getTokens(user, "user");
    await this.userModel.updateOne({ email: email }, { refreshToken: token.refresh_token });
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
      role: auth?.role,
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
      userId: auth._id,
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

  async createPassword(data: any) {

    const user_info = await this.userModel.findOne({ activationToken: data?.token });
    if (!user_info) {
      throw new NotFoundException('Invalid or expired activation link');
    }
    let payload: any
    try {
      payload = await this.jwtService.verifyAsync(data?.token, {
        secret: process.env.JWT_ACTIVATION_SECRET || 'yourVerySecureActivationSecret',
      });

    } catch (err) {
      throw new NotFoundException(`JWT verification failed: ${err.message}`);
    }

    console.log(payload.userId)
    const user = await this.userModel.findById(payload.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.activationToken = '';
    user.password = data.password;
    await user.save();

    return { message: 'Password updated successfully' };

  }

  async sendOtpForForgetPassword(forgotPassword: ForgotPasswordSendOtpDTO) {

    const user = await this.userModel.findOne({
      email: forgotPassword.email,
    });

    if (!user) {
      throw new HttpException(
        'User with this username does not exist',
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      otp: true,
      email: user.email,
    };
  }

  async verifyOtpForForgetPassword(forgotPassword: ForgotPasswordVerifyOtpDTO) {

    const user = await this.userModel.findOne({
      email: forgotPassword.email,
    });
    const jwt_token_key = this.config.get('ACCESS_TOKEN_SECRET') || 'ACCESS_TOKEN_SECRET';

    if (!user) {
      throw new HttpException(
        'User with this username does not exist',
        HttpStatus.NOT_FOUND,
      );
    }

    if (forgotPassword.otp == '123456') {
      const token = await this.jwtService.sign(user.toJSON(), {
        secret: jwt_token_key,
        expiresIn: '5m',
      });

      return { token };
    } else {
      throw new HttpException('Invalid OTP', HttpStatus.UNAUTHORIZED);
    }
  }

  async changePasswordForVerifiedCustomerOtp(
    changePasswordByOtp: VerifyTokenAndChangePasswordDTO,
  ) {

    const updatePassword = {
      password: changePasswordByOtp.password
    };

    const jwt_token_key = process.env.JWT_SECRET_KEY_ADMIN;
    let payload: any
    try {
      payload = await this.jwtService.verifyAsync(changePasswordByOtp.token, {
        secret: this.config.get('ACCESS_TOKEN_SECRET') || 'ACCESS_TOKEN_SECRET',
      });

    } catch (err) {
      throw new NotFoundException(`JWT verification failed: ${err.message}`);
    }
    const user = await this.userModel.findById(payload._id);

    if (!(user && user._id)) {
      throw new HttpException(
        'User with this username does not exist',
        HttpStatus.NOT_FOUND,
      );
    }

    // Update user password
    user.password = changePasswordByOtp.password;
    return await user.save();

  }
  async findUserWithPermissions(data: any, userId: string): Promise<any> {
    const user = await this.userModel.findById(userId)
    if (!user) {
      throw new HttpException(
        'User with this id does not exist',
        HttpStatus.NOT_FOUND
      )
    }
    const roles = await this.rolesModel.findOne({
      _id: user.role,
      isActive: true
    })

    // If roles not active the array becomes empty.
    if (!roles) {
      return []
    }
    const aggregateOptions = [
      {
        $match: {
          _id: user.role
        }
      },
      {
        $project: {
          permissions: 1,
          name: 1
        }
      },
      {
        $addFields: {
          roles: {
            $map: {
              input: '$permissions',
              as: 'el',
              in: {
                $map: {
                  input: {
                    $objectToArray: '$$el'
                  },
                  as: 'item',
                  in: {
                    $cond: {
                      if: {
                        $eq: ['$$item.v', true]
                      },
                      then: {
                        $concat: [
                          {
                            $first: {
                              $split: [
                                {
                                  $toLower: '$$el.name'
                                },
                                ' '
                              ]
                            }
                          },
                          '.',
                          '$$item.k'
                        ]
                      },
                      else: null
                    }
                  }
                }
              }
            }
          }
        }
      },
      {
        $addFields: {
          permissions: {
            $filter: {
              input: {
                $reduce: {
                  input: '$roles',
                  initialValue: [],
                  in: {
                    $concatArrays: ['$$value', '$$this']
                  }
                }
              },
              as: 'role',
              cond: {
                $ne: ['$$role', null]
              }
            }
          }
        }
      }
    ]
    const role = await this.rolesModel.aggregate(aggregateOptions).exec()

    return role[0].permissions
  }

}
