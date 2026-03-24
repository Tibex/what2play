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
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GamesService } from './games.service';
import { RateGameDto } from './dto/rate-game.dto';

@ApiTags('games')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/games')
export class GamesController {
  constructor(private gamesService: GamesService) {}

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
