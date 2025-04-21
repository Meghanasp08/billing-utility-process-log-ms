import { Controller, HttpStatus, Post } from '@nestjs/common';
import { MailService } from './mail.service';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) { }
  
  @Post('/welcome')
  async create(): Promise<any> {
    try {
      console.log("MAIL CHECKING")
      let mail_data = {
        event: "WELCOME",
        to_mail: "rahulmanikandan0298@gmail.com",
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
}
