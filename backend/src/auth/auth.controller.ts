import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Response,
  HttpCode,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response as ExpressResponse } from 'express';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { GoogleAuthGuard } from './google-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Request() req, @Body() _dto: LoginDto) {
    return this.authService.login(req.user);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  googleLogin() {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(@Request() req, @Response() res: ExpressResponse) {
    const data = await this.authService.login(req.user);
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const params = new URLSearchParams({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: JSON.stringify(data.user),
    });
    res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
  }
}
