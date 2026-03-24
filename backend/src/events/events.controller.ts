import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { RsvpDto } from './dto/rsvp.dto';

@ApiTags('events')
@Controller('api/events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new event' })
  create(@Request() req, @Body() dto: CreateEventDto) {
    return this.eventsService.create(req.user.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user events' })
  getUserEvents(@Request() req) {
    return this.eventsService.findUserEvents(req.user.id);
  }

  @Get('open')
  @ApiOperation({ summary: 'Get public open events' })
  getOpenEvents() {
    return this.eventsService.findOpenEvents();
  }

  @Get('invite/:token')
  @ApiOperation({ summary: 'Get event by invite token' })
  getByInvite(@Param('token') token: string) {
    return this.eventsService.getInviteEvent(token);
  }

  @Post('invite/:token/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Join event via invite link' })
  joinViaInvite(@Param('token') token: string, @Request() req) {
    return this.eventsService.joinViaInvite(token, req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get event details' })
  getEvent(@Param('id') id: string) {
    return this.eventsService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update event' })
  update(@Param('id') id: string, @Request() req, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, req.user.id, dto);
  }

  @Post(':id/rsvp')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'RSVP to an event' })
  rsvp(@Param('id') id: string, @Request() req, @Body() dto: RsvpDto) {
    return this.eventsService.rsvp(id, req.user.id, dto.status);
  }

  @Post(':id/invite-link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create invite link for event' })
  createInviteLink(@Param('id') id: string, @Request() req) {
    return this.eventsService.createInviteLink(id, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete event' })
  delete(@Param('id') id: string, @Request() req) {
    return this.eventsService.delete(id, req.user.id);
  }
}
