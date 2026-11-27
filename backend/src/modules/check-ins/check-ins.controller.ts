import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Role } from '../../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../../shared/identity/auth.types.js';
import { CurrentUser } from '../../shared/identity/decorators/current-user.decorator.js';
import { Roles } from '../../shared/identity/decorators/roles.decorator.js';
import { CreateCheckInDto } from './dto/create-check-in.dto.js';
import { CheckInResponseDto } from './dto/check-in-response.dto.js';
import { CheckInHistoryResponseDto } from './dto/check-in-history-response.dto.js';
import { ListCheckInsQueryDto } from './dto/list-check-ins-query.dto.js';
import { CheckInsService } from './check-ins.service.js';

@ApiTags('check-ins')
@Controller('check-ins')
export class CheckInsController {
  constructor(private readonly checkInsService: CheckInsService) {}

  @Get()
  @Roles(Role.admin, Role.trainer, Role.member)
  @ApiQuery({ name: 'memberId', required: false, type: Number })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    example: '2026-11-01',
    description:
      'Data inicial inclusiva no formato YYYY-MM-DD em America/Sao_Paulo.',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    example: '2026-11-26',
    description:
      'Data final inclusiva no formato YYYY-MM-DD em America/Sao_Paulo.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Página (padrão 1).',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    example: 20,
    description: 'Tamanho da página (padrão 20, máximo 100).',
  })
  @ApiOkResponse({
    description:
      'Histórico paginado; sem período, considera os últimos 30 dias locais em America/Sao_Paulo, incluindo hoje.',
    type: CheckInHistoryResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Filtros inválidos.' })
  @ApiForbiddenResponse({ description: 'Acesso negado ao histórico.' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCheckInsQueryDto,
  ) {
    return this.checkInsService.findAll(user, query);
  }

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
