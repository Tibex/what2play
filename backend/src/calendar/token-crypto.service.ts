import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

@Injectable()
export class TokenCryptoService {
  private readonly algorithm = 'aes-256-gcm';

  private getKey(): Buffer {
    const secret = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY || '';
    if (!secret.trim()) {
      throw new Error('CALENDAR_TOKEN_ENCRYPTION_KEY is not configured');
    }
    return createHash('sha256').update(secret).digest();
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const key = this.getKey();
    const cipher = createCipheriv(this.algorithm, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(cipherText: string): string {
    const [ivB64, authTagB64, encryptedB64] = cipherText.split(':');
    if (!ivB64 || !authTagB64 || !encryptedB64) {
      throw new Error('Invalid encrypted token payload');
    }
    const key = this.getKey();
    const decipher = createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(encryptedB64, 'base64')),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  }
}
