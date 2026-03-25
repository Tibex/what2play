import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: ConfigService,
    private authService: AuthService,
  ) {
    const clientID = config.get<string>('GOOGLE_CLIENT_ID') || 'not-configured';
    const clientSecret =
      config.get<string>('GOOGLE_CLIENT_SECRET') || 'not-configured';
    const callbackURL =
      config.get<string>('GOOGLE_CALLBACK_URL') ||
      'http://localhost:3001/api/auth/google/callback';
    super({ clientID, clientSecret, callbackURL, scope: ['email', 'profile'] });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('Google account has no email'), undefined);
      return;
    }

    const user = await this.authService.findOrCreateGoogleUser({
      email,
      name: profile.displayName || email.split('@')[0],
      googleId: profile.id,
      avatarUrl: profile.photos?.[0]?.value,
    });

    done(null, user);
  }
}
