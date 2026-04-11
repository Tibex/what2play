import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
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
import { GamesService } from './games.service';
import { RateGameDto } from './dto/rate-game.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { BatchAddCollectionDto } from './dto/batch-add-collection.dto';

@ApiTags('games')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search games by title' })
  @ApiQuery({ name: 'q', required: true })
  search(@Query('q') q: string) {
    return this.gamesService.searchGames(q);
  }

  @Get('collection')
  @ApiOperation({ summary: 'Get current user game collection' })
  getCollection(@Request() req) {
    return this.gamesService.getUserCollection(req.user.id);
  }

  @Post('collection/:gameId')
  @ApiOperation({ summary: 'Add game to collection' })
  addToCollection(@Request() req, @Param('gameId') gameId: string) {
    return this.gamesService.addToCollection(req.user.id, gameId);
  }

  @Delete('collection/:gameId')
  @ApiOperation({ summary: 'Remove game from collection' })
  removeFromCollection(@Request() req, @Param('gameId') gameId: string) {
    return this.gamesService.removeFromCollection(req.user.id, gameId);
  }

  @Post('collection/parse-shelf')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        cb(
          allowed.includes(file.mimetype)
            ? null
            : new BadRequestException('Unsupported image type'),
          allowed.includes(file.mimetype),
        );
      },
    }),
  )
  @ApiOperation({ summary: 'Parse shelf photo into candidate games' })
  parseShelfPhoto(
    @Request() req,
    @UploadedFile() file?: { mimetype: string; buffer: Buffer },
  ) {
    if (!file) throw new BadRequestException('Missing photo upload');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('Unsupported image type');
    }
    return this.gamesService.parseShelfPhoto(req.user.id, file.buffer);
  }

  @Post('collection/batch-add')
  @ApiOperation({ summary: 'Batch add selected games to collection' })
  batchAddCollection(@Request() req, @Body() dto: BatchAddCollectionDto) {
    return this.gamesService.batchAddToCollection(req.user.id, dto.items);
  }

  @Delete('admin/:gameId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Admin delete game from catalog' })
  removeGameForAdmin(@Param('gameId') gameId: string) {
    return this.gamesService.deleteForAdmin(gameId);
  }

  @Post('rate')
  @ApiOperation({ summary: 'Rate a game' })
  rateGame(@Request() req, @Body() dto: RateGameDto) {
    return this.gamesService.rateGame(
      req.user.id,
      dto.gameId,
      dto.rating,
      dto.notes,
    );
  }

  @Get('ratings')
  @ApiOperation({ summary: 'Get current user ratings' })
  getRatings(@Request() req) {
    return this.gamesService.getUserRatings(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get game by ID' })
  getGame(@Param('id') id: string) {
    return this.gamesService.findById(id);
  }
}
