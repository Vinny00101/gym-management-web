import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UpdateMemberDto } from '../common/dto/update-member.dto.js';
import { UpdateMemberStatusDto } from '../common/dto/update-member-status.dto.js';
import { Role } from '../generated/prisma/enums.js';
import {
  MemberResponse,
  MembersService,
} from '../services/members.service.js';

@ApiTags('members')
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Patch(':id')
  @Roles(Role.admin)
  @ApiOkResponse({ description: 'Dados pessoais do membro atualizados.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateMemberDto,
  ): Promise<MemberResponse> {
    return this.membersService.update(id, body);
  }

  @Patch(':id/status')
  @Roles(Role.admin)
  @ApiOkResponse({ description: 'Situacao do membro atualizada.' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateMemberStatusDto,
  ): Promise<MemberResponse> {
    return this.membersService.updateStatus(id, body);
  }
}
