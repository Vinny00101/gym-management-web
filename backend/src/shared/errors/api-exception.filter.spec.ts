import {
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { ApiExceptionFilter } from './api-exception.filter.js';

@Controller('errors')
class ErrorTestController {
  @Get('validation')
  validation(): never {
    throw new BadRequestException(['name must be a string']);
  }

  @Get('unauthorized')
  unauthorized(): never {
    throw new UnauthorizedException('Authentication required');
  }

  @Get('forbidden')
  forbidden(): never {
    throw new ForbiddenException('Access denied');
  }

  @Get('not-found')
  notFound(): never {
    throw new NotFoundException('User not found');
  }

  @Get('conflict')
  conflict(): never {
    throw new ConflictException('Email already exists');
  }

  @Get('unprocessable')
  unprocessable(): never {
    throw new UnprocessableEntityException('Invalid user state');
  }

  @Get('too-many-requests')
  tooManyRequests(): never {
    throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
  }

  @Get('prisma-unique')
  prismaUnique(): never {
    throw new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed for secret@example.com',
      {
        code: 'P2002',
        clientVersion: '7.10.1',
        meta: { target: ['email'] },
      },
    );
  }

  @Get('unexpected')
  unexpected(): never {
    throw new Error('Database connection details must not reach clients');
  }
}

describe('ApiExceptionFilter', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ErrorTestController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  it('returns validation details and the request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/errors/validation')
      .set('X-Request-Id', 'validation-request')
      .expect(HttpStatus.BAD_REQUEST);

    expect(response.body).toEqual({
      code: 'BAD_REQUEST',
      message: 'Validation failed',
      requestId: 'validation-request',
      details: ['name must be a string'],
    });
    expect(response.headers['x-request-id']).toBe('validation-request');
  });

  it.each([
    ['/errors/unauthorized', HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED'],
    ['/errors/forbidden', HttpStatus.FORBIDDEN, 'FORBIDDEN'],
    ['/errors/not-found', HttpStatus.NOT_FOUND, 'NOT_FOUND'],
    ['/errors/conflict', HttpStatus.CONFLICT, 'CONFLICT'],
    [
      '/errors/unprocessable',
      HttpStatus.UNPROCESSABLE_ENTITY,
      'UNPROCESSABLE_ENTITY',
    ],
    [
      '/errors/too-many-requests',
      HttpStatus.TOO_MANY_REQUESTS,
      'TOO_MANY_REQUESTS',
    ],
  ])('preserves HTTP status and code for %s', async (path, status, code) => {
    const response = await request(app.getHttpServer())
      .get(path)
      .expect(status);

    expect(response.body.code).toBe(code);
    expect(response.body.requestId).toBeDefined();
  });

  it('maps Prisma unique constraint violations to a generic 409', async () => {
    const response = await request(app.getHttpServer())
      .get('/errors/prisma-unique')
      .expect(HttpStatus.CONFLICT);

    expect(response.body.message).toBe(
      'A record with the provided unique value already exists.',
    );
    expect(response.text).not.toContain('secret@example.com');
  });

  it('hides unexpected error details and returns a generic 500', async () => {
    const response = await request(app.getHttpServer())
      .get('/errors/unexpected')
      .expect(HttpStatus.INTERNAL_SERVER_ERROR);

    expect(response.body).toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
    expect(response.text).not.toContain(
      'Database connection details must not reach clients',
    );
  });

  afterEach(async () => {
    await app.close();
  });
});
