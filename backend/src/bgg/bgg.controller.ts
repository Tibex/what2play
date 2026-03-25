import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BggService } from './bgg.service';
import { LinkBggDto } from './dto/link-bgg.dto';
import { ImportBggXmlDto } from './dto/import-bgg-xml.dto';
import { ImportOneGameDto } from './dto/import-one-game.dto';

@ApiTags('bgg')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/bgg')
export class BggController {
  constructor(private bggService: BggService) {}

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
  @ApiOperation({ summary: 'Import a single game from BGG and add to collection' })
  importOne(@Request() req, @Body() dto: ImportOneGameDto) {
    return this.bggService.importOneGame(req.user.id, dto.bggId);
  }
}
