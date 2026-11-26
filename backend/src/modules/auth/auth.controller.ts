import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { LoginResult } from '../../shared/identity/auth.types.js';
import { AuthService } from './auth.service.js';
import { Public } from '../../shared/identity/decorators/public.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { REFRESH_COOKIE_NAME } from './refresh-token.service.js';

@Public()
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'Access token e cookie de refresh token.' })
  login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResult> {
    return this.authService.login(
      body.email,
      body.password,
      request,
      response,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Novo access token e refresh token rotacionado.' })
  refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResult> {
    return this.authService.refresh(
      request.cookies?.[REFRESH_COOKIE_NAME],
      response,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(
      request.cookies?.[REFRESH_COOKIE_NAME],
      response,
    );
  }
}
