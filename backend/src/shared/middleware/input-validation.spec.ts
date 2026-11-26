import {
  Body,
  Controller,
  Get,
  MiddlewareConsumer,
  Module,
  NestModule,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { InputSanitizationMiddleware } from './input-sanitization.middleware.js';
import { configureValidation } from './configure-validation.js';

class ExampleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;
}

@Controller('validation-test')
class ValidationTestController {
  @Post()
  create(@Body() dto: ExampleDto) {
    return {
      isDto: dto instanceof ExampleDto,
      name: dto.name,
      email: dto.email,
    };
  }

  @Get('query')
  getQuery(@Query('term') term: string) {
    return { term };
  }

  @Get('params/:term')
  getParam(@Param('term') term: string) {
    return { term };
  }
}

@Module({ controllers: [ValidationTestController] })
class ValidationTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(InputSanitizationMiddleware).forRoutes('*');
  }
}

describe('Input sanitization and validation', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ValidationTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureValidation(app);
    await app.init();
  });

  it('sanitizes strings and transforms request bodies into DTO instances', async () => {
    await request(app.getHttpServer())
      .post('/validation-test')
      .send({
        name: ' \tAli\u0000ce \n',
        email: 'member@example.com',
      })
      .expect(201)
      .expect({
        isDto: true,
        name: 'Alice',
        email: 'member@example.com',
      });
  });

  it('sanitizes query strings before the controller receives them', async () => {
    await request(app.getHttpServer())
      .get('/validation-test/query?term=%20hey%00there%20')
      .expect(200)
      .expect({ term: 'heythere' });
  });

  it('sanitizes route parameters before the controller receives them', async () => {
    await request(app.getHttpServer())
      .get('/validation-test/params/%20hey%00there%20')
      .expect(200)
      .expect({ term: 'heythere' });
  });

  it('rejects unknown body properties', async () => {
    await request(app.getHttpServer())
      .post('/validation-test')
      .send({
        name: 'Alice',
        email: 'member@example.com',
        role: 'admin',
      })
      .expect(400);
  });

  it('rejects invalid DTO values', async () => {
    await request(app.getHttpServer())
      .post('/validation-test')
      .send({ name: 'Alice', email: 'not-an-email' })
      .expect(400);
  });

  afterEach(async () => {
    await app.close();
  });
});
