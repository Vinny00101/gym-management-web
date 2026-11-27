import { VersioningType, type INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { ApiExceptionFilter } from '../shared/errors/api-exception.filter.js';
import { SecurityEventInterceptor } from '../shared/security/security-event.interceptor.js';
import { SecurityEventService } from '../shared/security/security-event.service.js';
import { SensitiveDataInterceptor } from '../shared/security/sensitive-data.interceptor.js';
import { configureValidation } from '../shared/middleware/configure-validation.js';
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";

export function configureHttp(app: INestApplication){
    app.use(helmet());

    const swaggerConfig = new DocumentBuilder()
        .setTitle('API de Gerenciamento de Academias')
        .setDescription('API para gestão de academias')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
      const documentFactory = () => SwaggerModule.createDocument(app, swaggerConfig);
      SwaggerModule.setup('api/docs', app, documentFactory);
}

/**
 * Pipeline HTTP compartilhada por `main.ts` e pelos testes e2e.
 *
 * Todo middleware, pipe, interceptor ou filtro global deve ser registrado
 * aqui, para que a aplicação executada e a aplicação testada tenham exatamente
 * o mesmo comportamento. Configurações do `NestFactory` (logger, instrumentação
 * e shutdown hooks) continuam no bootstrap.
 */
export function setupApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.use(cookieParser());
  configureHttp(app);
  configureValidation(app);
  app.useGlobalInterceptors(
    new SecurityEventInterceptor(app.get(SecurityEventService)),
    new SensitiveDataInterceptor(),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
}