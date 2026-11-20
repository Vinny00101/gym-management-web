import { Injectable } from '@nestjs/common';
import { hashPassword, verifyPassword } from './password.crypto.js';

/**
 * Único ponto da aplicação que conhece a senha em texto puro.
 * Usado pelo login e disponibilizado para os cadastros pelo AuthModule.
 */
@Injectable()
export class PasswordService {
  hash(plainPassword: string): Promise<string> {
    return hashPassword(plainPassword);
  }

  verify(plainPassword: string, passwordHash: string): Promise<boolean> {
    return verifyPassword(plainPassword, passwordHash);
  }
}
