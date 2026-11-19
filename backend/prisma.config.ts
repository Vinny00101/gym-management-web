import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { resolve } from 'node:path';

// O .env fica na raiz do repositório (compartilhado pelo backend e pelo Docker Compose).
loadEnv({
  path: [resolve(process.cwd(), '../.env'), resolve(process.cwd(), '.env')],
});

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
