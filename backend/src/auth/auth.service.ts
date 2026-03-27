import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import appleSigninAuth from 'apple-signin-auth';
import { User } from '../entities/user.entity';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 12);
    const user = this.usersRepo.create({ ...dto, password: hashed });
    await this.usersRepo.save(user);
    return this.generateTokens(user);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersRepo.findOne({ where: { email } });
    if (user?.password && (await bcrypt.compare(password, user.password))) {
      return user;
    }
    return null;
  }

  async login(user: User) {
    return this.generateTokens(user);
  }

  async findOrCreateGoogleUser(profile: {
    email: string;
    name: string;
    googleId: string;
    avatarUrl?: string;
  }): Promise<User> {
    let user = await this.usersRepo.findOne({
      where: { email: profile.email },
    });

    if (user) {
      user.socialProvider = 'google';
      user.socialId = profile.googleId;
      if (!user.avatarUrl && profile.avatarUrl) {
        user.avatarUrl = profile.avatarUrl;
      }
      return this.usersRepo.save(user);
    }

    user = this.usersRepo.create({
      email: profile.email,
      name: profile.name,
      socialProvider: 'google',
      socialId: profile.googleId,
      avatarUrl: profile.avatarUrl,
    });
    return this.usersRepo.save(user);
  }

  async loginWithApple(identityToken: string, fallbackName?: string) {
    const clientId = this.configService.get<string>('APPLE_CLIENT_ID');
    if (!clientId) {
      throw new UnauthorizedException('Apple login is not configured');
    }

    let claims: {
      sub: string;
      email?: string;
      email_verified?: string | boolean;
    };
    try {
      claims = (await appleSigninAuth.verifyIdToken(identityToken, {
        audience: clientId,
        ignoreExpiration: false,
      })) as {
        sub: string;
        email?: string;
        email_verified?: string | boolean;
      };
    } catch {
      throw new UnauthorizedException('Invalid Apple identity token');
    }

    let user = await this.usersRepo.findOne({
      where: { socialProvider: 'apple', socialId: claims.sub },
    });

    if (!user && claims.email) {
      user = await this.usersRepo.findOne({ where: { email: claims.email } });
    }

    if (!user && !claims.email) {
      throw new UnauthorizedException(
        'Apple did not provide an email for this account',
      );
    }

    if (user) {
      user.socialProvider = 'apple';
      user.socialId = claims.sub;
      if (!user.name && fallbackName) {
        user.name = fallbackName.trim();
      }
      await this.usersRepo.save(user);
      return this.generateTokens(user);
    }

    const created = this.usersRepo.create({
      email: claims.email!,
      name: fallbackName?.trim() || 'Apple User',
      socialProvider: 'apple',
      socialId: claims.sub,
    });
    await this.usersRepo.save(created);
    return this.generateTokens(created);
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_SECRET'),
      });
      const user = await this.usersRepo.findOne({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException();
      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        subscriptionTier: user.subscriptionTier,
        role: user.role,
      },
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '7d'),
      }),
    };
  }
}
