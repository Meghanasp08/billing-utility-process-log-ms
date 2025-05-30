// import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { JwtService } from '@nestjs/jwt';
// import { AuthService } from '../auth.service';

// @Injectable()
// export class JwtAuthGuard implements CanActivate {
//   config: ConfigService;

//   constructor(private jwtService: JwtService, private authService: AuthService) { }

//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     const request = context.switchToHttp().getRequest();
//     const accessToken = request.headers.authorization?.split(' ')[1];

//     const refreshToken = request.body?.refresh_token || request.cookies?.refresh_token;

//     if (!accessToken && !refreshToken) {
//       return false;
//     }

//     try {
//       if (accessToken) {
//         const decoded = this.jwtService.verify(accessToken, { secret: process.env.ACCESS_TOKEN_SECRET });
//         request.user = decoded;
//         return true;
//       }

//       if (refreshToken) {
//         const decodedRefreshToken = this.jwtService.verify(refreshToken, {
//           secret: process.env.REFRESH_TOKEN_SECRET
//         });
//         const user = await this.authService.getUserData(decodedRefreshToken.userId);
//         if (user && user.refreshToken === refreshToken) {
//           request.user = decodedRefreshToken;
//           return true;
//         }
//       }
//     } catch (error) {
//       console.log(error)
//       return false;
//     }

//     return false;
//   }
// }
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService, private authService: AuthService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const accessToken = request.headers.authorization?.split(' ')[1];
    const refreshToken = request.body?.refresh_token || request.cookies?.refresh_token;

    if (!accessToken && !refreshToken) {
      throw new UnauthorizedException('Access token or refresh token must be provided');
    }

    try {
      if (accessToken) {
        const decoded = this.jwtService.verify(accessToken, {
          secret: process.env.ACCESS_TOKEN_SECRET,
        });
        request.user = decoded;
        request.user.permission =  await this.authService.findUserWithPermissions(decoded,decoded.userId);
        return true;
      }
    } catch (error) {
      if (error.name === 'TokenExpiredError' && refreshToken) {
        try {
          const decodedRefreshToken = this.jwtService.verify(refreshToken, {
            secret: process.env.REFRESH_TOKEN_SECRET,
          });

          const user = await this.authService.getUserData(decodedRefreshToken.userId);
          if (user && user.refreshToken === refreshToken) {
            request.user = decodedRefreshToken;
            request.user.permission =  await this.authService.findUserWithPermissions(decodedRefreshToken,decodedRefreshToken.userId);
            return true; // Allow access
          }
        } catch (refreshError) {
          throw new UnauthorizedException('Invalid or expired refresh token');
        }
      } else {
        throw new UnauthorizedException('Invalid access token');
      }
    }

    throw new UnauthorizedException('Authentication failed');
  }
}