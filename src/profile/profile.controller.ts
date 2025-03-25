import { Controller, Get, HttpStatus, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProfileService } from './profile.service';

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) { }

  // @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get()
  async getProfile(@Req() req: any) {
    try {
      const users = await this.profileService.getProfile();
      return {
        message: 'List of users',
        result: users,
        statusCode: HttpStatus.OK
      }
    } catch (error) {
      throw error;
    }
  }


}
