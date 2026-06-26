import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccessModule } from '../../common/decorators/access-module.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { CreateNarrativeDto } from './dto/create-narrative.dto';
import { SaveNarrativeGraphDto } from './dto/save-narrative-graph.dto';
import { UpdateNarrativeDto } from './dto/update-narrative.dto';
import { ValidateNarrativeDto } from './dto/validate-narrative.dto';
import { CreateNarrativeRunDto } from '../narrative-runs/dto/create-narrative-run.dto';
import { NarrativeRunsService } from '../narrative-runs/narrative-runs.service';
import { NarrativesService } from './narratives.service';

@ApiTags('narratives')
@ApiCookieAuth('cookie')
@Controller('narratives')
@AccessModule('admin.narratives')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NarrativesController {
  constructor(
    private readonly narrativesService: NarrativesService,
    private readonly narrativeRunsService: NarrativeRunsService,
  ) {}

  @Get()
  @Permissions('narratives:view')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.narrativesService.list(user);
  }

  @Get('active')
  @Permissions('narratives:run')
  active(@CurrentUser() user: AuthenticatedUser) {
    return this.narrativesService.active(user);
  }

  @Get(':id')
  @Permissions('narratives:view')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.narrativesService.findOne(user, id);
  }

  @Post()
  @Permissions('narratives:create')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateNarrativeDto,
  ) {
    return this.narrativesService.create(user, dto);
  }

  @Patch(':id')
  @Permissions('narratives:update')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateNarrativeDto,
  ) {
    return this.narrativesService.update(user, id, dto);
  }

  @Post(':id/archive')
  @Permissions('narratives:archive')
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.narrativesService.archive(user, id);
  }

  @Post(':id/duplicate')
  @Permissions('narratives:create')
  duplicate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.narrativesService.duplicate(user, id);
  }

  @Get(':id/builder')
  @Permissions('narratives:update')
  builder(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.narrativesService.getBuilderState(user, id);
  }

  @Patch(':id/graph')
  @Permissions('narratives:update')
  saveGraph(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SaveNarrativeGraphDto,
  ) {
    return this.narrativesService.saveGraph(user, id, dto);
  }

  @Post(':id/validate')
  @Permissions('narratives:view')
  validate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ValidateNarrativeDto,
  ) {
    return this.narrativesService.validate(user, id, dto.graphJson);
  }

  @Post(':id/publish')
  @Permissions('narratives:publish')
  publish(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.narrativesService.publish(user, id);
  }

  @Post(':id/runs')
  @Permissions('narratives:run')
  startRun(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateNarrativeRunDto,
  ) {
    return this.narrativeRunsService.create(user, id, dto);
  }
}
