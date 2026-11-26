import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    setupFiles: ['./test/setup.ts'],
    // O AppModule carrega Observe/config no beforeAll e pode levar mais de 10s
    // quando os arquivos e2e rodam em paralelo.
    hookTimeout: 30_000,
    include: ['**/*.e2e-spec.ts'],
  },
});
