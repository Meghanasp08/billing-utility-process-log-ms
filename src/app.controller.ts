import { Controller, Get } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @EventPattern('process_upload')
  async handleFileUpload(@Payload() data: any) {
    console.log('📥 Received upload event:', data);
    try {
      await this.appService.processUploadedFiles(data);
      return { success: true, message: 'Files processed successfully' };
    } catch (error) {
      console.error('❌ Error processing upload:', error);
      return { success: false, error: error.message };
    }
  }
}
