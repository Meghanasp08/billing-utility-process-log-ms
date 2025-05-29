import { Body, Controller, Get, HttpStatus, NotFoundException, Param, Post } from '@nestjs/common';
import { MailService } from './mail.service';
import { SmtpConfigDto } from './dto/mail.dto';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) { }

  @Post('/smtp-test')
  async testSmtp(@Body() config: SmtpConfigDto): Promise<any> {
    return await this.mailService.testSmtp(config);
  }

  @Post('/welcome')
  async create(): Promise<any> {
    try {
      console.log("MAIL CHECKING")
      let mail_data = {
        event: "WELCOME",
        to_mail: "rahulmm@activelobby.net",
      }
      const result = await this.mailService.sendEmail(mail_data);
      return {
        message: 'Mail Sent.',
        result: result,
        statusCode: HttpStatus.OK
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Get('activate/:token')
  async activateUser(@Param('token') token: string) {
    try {
      const result = await this.mailService.activateUser(token);

      return {
        message: 'Account activated successfully',
        result: result,
        statusCode: HttpStatus.OK
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

}

