import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ListMembersDto } from '../common/dto/list-members.dto.js';
import { Role } from '../generated/prisma/enums.js';
import {
  MemberListResponse,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreateMemberDto } from '../common/dto/create-member.dto.js';
import { Role } from '../generated/prisma/enums.js';
import {
  MemberResponse,
  MembersService,
} from '../services/members.service.js';

@ApiTags('members')
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @Roles(Role.admin, Role.trainer)
  @ApiOkResponse({ description: 'Lista paginada de membros.' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMembersDto,
  ): Promise<MemberListResponse> {
    return this.membersService.findAll(user, query);
  }

  @Get(':id')
  @Roles(Role.admin, Role.trainer)
  @ApiOkResponse({ description: 'Dados de um membro.' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<MemberResponse> {
    return this.membersService.findOne(user, id);
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.admin)
  @ApiCreatedResponse({ description: 'Membro cadastrado.' })
  create(@Body() body: CreateMemberDto): Promise<MemberResponse> {
    return this.membersService.create(body);
  }
}
