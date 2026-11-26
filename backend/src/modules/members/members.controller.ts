import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../shared/identity/auth.types.js';
import { CurrentUser } from '../../shared/identity/decorators/current-user.decorator.js';
import { Roles } from '../../shared/identity/decorators/roles.decorator.js';
import { AssignTrainerDto } from './dto/assign-trainer.dto.js';
import { CreateMemberDto } from './dto/create-member.dto.js';
import { ListMembersDto } from './dto/list-members.dto.js';
import { UpdateMemberStatusDto } from './dto/update-member-status.dto.js';
import { UpdateMemberDto } from './dto/update-member.dto.js';
import { Role } from '../../generated/prisma/enums.js';
import { MembersService } from './members.service.js';

@ApiTags('members')
@Controller()
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post('members')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.admin)
  @ApiCreatedResponse({ description: 'Membro cadastrado.' })
  create(@Body() body: CreateMemberDto) {
    return this.membersService.create(body);
  }

  @Get('members')
  @Roles(Role.admin, Role.trainer)
  @ApiOkResponse({ description: 'Lista paginada de membros.' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMembersDto,
  ) {
    return this.membersService.findAll(user, query);
  }

  @Get('members/:id')
  @Roles(Role.admin, Role.trainer)
  @ApiOkResponse({ description: 'Dados de um membro.' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.membersService.findOne(user, id);
  }

  @Patch('members/:id')
  @Roles(Role.admin)
  @ApiOkResponse({ description: 'Dados pessoais do membro atualizados.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateMemberDto,
  ) {
    return this.membersService.update(id, body);
  }

  @Patch('members/:id/status')
  @Roles(Role.admin)
  @ApiOkResponse({ description: 'Situacao do membro atualizada.' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateMemberStatusDto,
  ) {
    return this.membersService.updateStatus(id, body);
  }

  @Put('members/:id/trainer')
  @Roles(Role.admin)
  @ApiOkResponse({ description: 'Instrutor responsavel vinculado ao membro.' })
  assignTrainer(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AssignTrainerDto,
  ) {
    return this.membersService.assignTrainer(id, body);
  }

  @Get('me')
  @Roles(Role.member)
  @ApiOkResponse({ description: 'Perfil do membro autenticado.' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.membersService.getProfile(user);
  }
}
