import {
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

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.admin)
  @ApiCreatedResponse({ description: 'Membro cadastrado.' })
  create(@Body() body: CreateMemberDto): Promise<MemberResponse> {
    return this.membersService.create(body);
  }
}
