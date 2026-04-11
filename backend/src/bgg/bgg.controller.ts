import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
  Logger,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { BggService } from './bgg.service';
import { LinkBggDto } from './dto/link-bgg.dto';
import { ImportBggXmlDto } from './dto/import-bgg-xml.dto';
import { ImportOneGameDto } from './dto/import-one-game.dto';
import { SyncSelectedDto } from './dto/sync-selected.dto';
import type { Response } from 'express';

@ApiTags('bgg')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/bgg')
export class BggController {
  private readonly logger = new Logger(BggController.name);

  constructor(private readonly bggService: BggService) {}

  @Post('link')
  @ApiOperation({ summary: 'Link BoardGameGeek account' })
  link(@Request() req, @Body() dto: LinkBggDto) {
    return this.bggService.linkAccount(req.user.id, dto.bggUsername);
  }

  @Delete('link')
  @ApiOperation({ summary: 'Unlink BoardGameGeek account' })
  unlink(@Request() req) {
    return this.bggService.unlinkAccount(req.user.id);
  }

  @Get('link')
  @ApiOperation({ summary: 'Get linked BGG account' })
  getLink(@Request() req) {
    return this.bggService.getLinkedAccount(req.user.id);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Create verification challenge for BGG account' })
  verify(@Request() req) {
    return this.bggService.createVerificationChallenge(req.user.id);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync game collection from BGG' })
  sync(@Request() req) {
    return this.bggService.syncCollection(req.user.id);
  }

  @Post('import-xml')
  @ApiOperation({ summary: 'Import BGG collection from pasted XML' })
  importXml(@Request() req, @Body() dto: ImportBggXmlDto) {
    return this.bggService.importCollectionFromXml(req.user.id, dto.xml);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search BoardGameGeek catalog by title' })
  @ApiQuery({ name: 'q', required: true })
  searchBgg(@Query('q') q: string) {
    return this.bggService.searchBgg(q);
  }

  @Post('import-one')
  @ApiOperation({
    summary: 'Import a single game from BGG and add to collection',
  })
  importOne(@Request() req, @Body() dto: ImportOneGameDto) {
    return this.bggService.importOneGame(req.user.id, dto.bggId);
  }

  @Post('collection/sync-selected')
  @ApiOperation({ summary: 'Sync selected items to BGG collection' })
  syncSelected(@Request() req, @Body() dto: SyncSelectedDto) {
    return this.bggService.syncSelectedToBggCollection(req.user.id, dto.items);
  }

  @Get('collection/export.csv')
  @ApiOperation({ summary: 'Export selected collection items as CSV' })
  async exportCsv(
    @Request() req,
    @Query('gameIds') gameIdsParam: string,
    @Res() res: Response,
  ) {
    const gameIds = (gameIdsParam || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const csv = await this.bggService.exportSelectionAsCsv(
      req.user.id,
      gameIds,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="bgg-export.csv"',
    );
    res.send(csv);
  }

  @Get('collection/export.xml')
  @ApiOperation({ summary: 'Export selected collection items as BGG XML' })
  async exportXml(
    @Request() req,
    @Query('gameIds') gameIdsParam: string,
    @Res() res: Response,
  ) {
    const gameIds = (gameIdsParam || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const xml = await this.bggService.exportSelectionAsXml(
      req.user.id,
      gameIds,
    );
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="bgg-export.xml"',
    );
    res.send(xml);
  }

  @Post('admin/import-top-catalog')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary:
      'Admin: force import top BGG catalog immediately (ignores weekly cooldown)',
  })
  importTopCatalogNow(
    @Query('limit', new DefaultValuePipe(500), ParseIntPipe) limit: number,
  ) {
    // Run in background so HTTP request does not hit platform router timeout.
    void this.bggService
      .runTopRankedImportWithCooldown({
        limit,
        force: true,
        trigger: 'manual',
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Unknown catalog sync error';
        this.logger.error(
          `Background BGG top catalog import failed: ${message}`,
        );
      });

    return {
      status: 'queued',
      requested: limit,
    };
  }

  @Get('admin/catalog-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Admin: get BGG catalog sync and quality stats' })
  getCatalogStats() {
    return this.bggService.getAdminCatalogStats();
  }

  @Post('admin/repair-incomplete-catalog')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Admin: repair incomplete game metadata from BGG by bggId',
  })
  repairIncompleteCatalog(
    @Query('limit', new DefaultValuePipe(200), ParseIntPipe) limit: number,
  ) {
    return this.bggService.repairIncompleteCatalogData(limit);
  }

  @Get('admin/incomplete-catalog')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary:
      'Admin: list catalog games missing year, player-count poll, or playtime',
  })
  getIncompleteCatalog(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(100), ParseIntPipe)
    pageSize: number,
  ) {
    return this.bggService.getAdminIncompleteCatalogEntries(page, pageSize);
  }
}
