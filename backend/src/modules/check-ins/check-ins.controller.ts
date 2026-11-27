import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Role } from '../../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../../shared/identity/auth.types.js';
import { CurrentUser } from '../../shared/identity/decorators/current-user.decorator.js';
import { Roles } from '../../shared/identity/decorators/roles.decorator.js';
import { CreateCheckInDto } from './dto/create-check-in.dto.js';
import { CheckInResponseDto } from './dto/check-in-response.dto.js';
import { CheckInsService } from './check-ins.service.js';

@ApiTags('check-ins')
@Controller('check-ins')
export class CheckInsController {
  constructor(private readonly checkInsService: CheckInsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.member, Role.admin)
  @ApiBody({ type: CreateCheckInDto, required: false })
  @ApiCreatedResponse({
    description: 'Check-in registrado.',
    type: CheckInResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Dados do check-in inválidos.' })
  @ApiForbiddenResponse({ description: 'Acesso negado.' })
  @ApiNotFoundResponse({ description: 'Membro não encontrado.' })
  @ApiConflictResponse({ description: 'Já existe check-in neste dia local.' })
  @ApiUnprocessableEntityResponse({
    description: 'Apenas membros ativos podem fazer check-in.',
  })
  checkIn(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCheckInDto = {},
  ) {
    return this.checkInsService.checkIn(user, body.memberId);
  }
}
