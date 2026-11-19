import { Injectable, PipeTransform } from '@nestjs/common';
import { sanitizeInput } from '../middleware/input-sanitization.middleware.js';

@Injectable()
export class InputSanitizationPipe implements PipeTransform {
  transform(value: unknown): unknown {
    return sanitizeInput(value);
  }
}
