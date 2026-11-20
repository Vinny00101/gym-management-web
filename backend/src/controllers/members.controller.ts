import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AssignTrainerDto } from '../common/dto/assign-trainer.dto.js';
import { Role } from '../generated/prisma/enums.js';
import { MembersService } from '../services/members.service.js';

@ApiTags('members')
@Controller()
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

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
