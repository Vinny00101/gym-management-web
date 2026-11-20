import Joi from 'joi';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import { hashPassword } from '../dist/auth/password.crypto.js';

const { error, value } = Joi.object({
  DATABASE_URL: Joi.string().required(),
  ADMIN_NAME: Joi.string().trim().min(1).required(),
  ADMIN_EMAIL: Joi.string().trim().email().required(),
  ADMIN_PASSWORD: Joi.string().min(1).required(),
})
  .unknown(true)
  .validate(process.env);

if (error) {
  throw new Error(
    'DATABASE_URL, ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD must be configured before running the seed.',
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: value.DATABASE_URL }),
});

try {
  // O seed usa o mesmo PasswordService da API (via password.crypto.js),
  // compilado pelo `npm run build` que precede `prisma db seed`.
  const passwordHash = await hashPassword(value.ADMIN_PASSWORD);
  const admin = await prisma.user.upsert({
    where: { email: value.ADMIN_EMAIL },
    update: {},
    create: {
      name: value.ADMIN_NAME,
      email: value.ADMIN_EMAIL,
      passwordHash,
      role: 'admin',
      status: 'active',
    },
  });

  if (admin.role !== 'admin') {
    throw new Error(
      'ADMIN_EMAIL belongs to a non-admin user; refusing to change that account.',
    );
  }

  console.info('Administrator seed completed.');
} finally {
  await prisma.$disconnect();
}
