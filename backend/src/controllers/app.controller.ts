import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from '../services/app.service.js';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Returns a welcome message' })
  @ApiResponse({ status: 200, description: 'Welcome message returned' })
  getHello(): string {
    return this.appService.getHello();
  }
}
