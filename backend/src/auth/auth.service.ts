import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 12);
    const user = this.usersRepo.create({ ...dto, password: hashed });
    await this.usersRepo.save(user);
    return this.generateTokens(user);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersRepo.findOne({ where: { email } });
    if (user && user.password && (await bcrypt.compare(password, user.password))) {
      return user;
    }
    return null;
  }

  async login(user: User) {
    return this.generateTokens(user);
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
    const payload = { sub: user.id, email: user.email };
    return {
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, subscriptionTier: user.subscriptionTier },
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '7d'),
      }),
    };
  }
}
