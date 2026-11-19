import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

export function configureHttp(app: INestApplication): void {
  app.use(helmet());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Gym Management API')
    .setDescription('API for gym management')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);
}
