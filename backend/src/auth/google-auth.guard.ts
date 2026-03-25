import {
  Injectable,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private config: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (!this.config.get('GOOGLE_CLIENT_ID')) {
      throw new BadRequestException('Google login is not configured');
    }
    return super.canActivate(context);
  }
}
