import { INestApplication, ValidationPipe } from '@nestjs/common';
import { InputSanitizationPipe } from './input-sanitization.pipe.js';

export function configureValidation(app: INestApplication): void {
  app.useGlobalPipes(
    new InputSanitizationPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
