import { Body, Controller, HttpStatus, Post, Request, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { getAccessTokenUsingRefreshTokenDto } from './dto/token.dto';
import { CreateUserDto, ForgotPasswordSendOtpDTO, ForgotPasswordVerifyOtpDTO, VerifyTokenAndChangePasswordDTO } from './dto/user.dto';
import { JwtAuthGuard } from './guard/jwt-auth-guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Log in a user' })
  @ApiResponse({ status: 200, description: 'User successfully logged in.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  async login(@Body() loginDto: LoginDto) {
    try {
      const token = await this.authService.login(loginDto);
      return {
        message: 'Successfully logged in',
        result: token,
        statusCode: HttpStatus.OK
      }
    } catch (error) {
      console.log(error);
      throw error;
      //throw new ErrorResponseDTO(error)
    }
  }

  @Post('signup')
  @ApiOperation({ summary: 'Sign up a new user' })
  @ApiResponse({ status: 201, description: 'User successfully created.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  async signup(@Body() createUserDto: CreateUserDto) {
    try {
      const user = await this.authService.signup(createUserDto);
    return {
      message: 'User successfully created',
      result: user,
      statusCode: HttpStatus.CREATED
    }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/token')
  async adminToken(
    @Body(ValidationPipe) tokenDto: getAccessTokenUsingRefreshTokenDto,
    @Request() req: any,
  ) {
    try {
      const token = await this.authService.getAccessTokenUsingRefreshToken(
        tokenDto,
        req,
        'user',
      );
      return {
        message: 'Logged in successfully',
        result: token,
        statusCode: HttpStatus.OK,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Post('/create-password')
  async createPassword(
    @Body(ValidationPipe) data: any,
    @Request() req: any,
  ) {
    try {
      const result = await this.authService.createPassword(data);
      return {
        message: 'Password updated successfully',
        result: result,
        statusCode: HttpStatus.OK,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

   @Post('forgot-password/otp')
  async sendOtpForForgetPassword(
    @Body(ValidationPipe) forgotPassword: ForgotPasswordSendOtpDTO,
  ) {
    try {
      const result =
        await this.authService.sendOtpForForgetPassword(forgotPassword);
      return {
        message: 'The link has been successfully sent to your email address',
        result: result,
        statusCode: HttpStatus.OK,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Post('forgot-password/verify_otp')
  async verifyOtpForForgetPassword(
    @Body(ValidationPipe) forgotPassword: ForgotPasswordVerifyOtpDTO,
  ) {
    try {
      const result =
        await this.authService.verifyOtpForForgetPassword(forgotPassword);
      return {
        message: 'OTP verified successfully',
        result: result,
        statusCode: HttpStatus.OK,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Post('forgot-password/change_password')
  async changePasswordForVerifiedOtp(
    @Body(ValidationPipe)
    changePasswordByOtp: VerifyTokenAndChangePasswordDTO,
  ) {
    try {
      const result =
        await this.authService.changePasswordForVerifiedCustomerOtp(
          changePasswordByOtp,
        );
      return {
        message: 'Password changed successfully',
        result: result,
        statusCode: HttpStatus.OK,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
