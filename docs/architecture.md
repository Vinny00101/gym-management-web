# Arquitetura do backend

Voltar para o [README](../README.md).

Este documento registra a decisão aprovada na [issue #45](https://github.com/Vinny00101/gym-management-web/issues/45). A refatoração é **pré-requisito** das tasks abertas #36–#42: treinos, check-ins e relatórios devem ser implementados sobre a estrutura descrita aqui.

## Estado atual (diagnóstico)

- `AuthModule` registra hoje 4 controllers (`auth`, `members`, `staff`, `workout-plans`) e 10 providers de domínios diferentes. Ele é o único ponto de composição de quase toda a API — o que deveria ser um módulo de autenticação virou um módulo da aplicação inteira.
- `backend/src` é organizado por camada técnica (`controllers/`, `services/`, `common/dto/`, `common/guards/`). Uma única feature fica espalhada por várias pastas, e não há fronteira explícita entre domínios.
- As rotas não têm prefixo nem versão: `/auth/login`, `/members`, `/workout-plans`. O README e o proxy NGINX, porém, já colocam a API em `/api`.
- `setupApp()` não existe: `main.ts` aplica helmet, Swagger, validação, interceptadores e filtros, enquanto os testes e2e montam a aplicação por conta própria. Qualquer configuração nova precisa ser repetida em dois lugares.
- No diagnóstico inicial, o cache Redis aparecia no README e no `docker-compose.dev.yml`, mas `@nestjs/cache-manager`, `cache-manager` e `@keyv/redis` não estavam instalados; `REDIS_URL` e `CACHE_TTL` também não eram validados. O T3 resolve esse ponto.
- `REFRESH_COOKIE_PATH = '/auth'` está acoplado à rota atual. Com `/api/v1/auth/refresh`, o navegador deixaria de enviar o cookie e o refresh quebraria.

## Decisão

1. **Módulos por domínio.** Cada feature tem seu próprio módulo, com controller, service, DTOs e testes colocalizados. As pastas globais `controllers/` e `services/` deixam de existir — os conceitos permanecem, apenas mudam de lugar.
2. **`infra/` para o mundo externo.** Banco, cache, configuração, logging, HTTP/Swagger, observabilidade e health check ficam juntos, com módulos pequenos e explícitos.
3. **`shared/` para política da aplicação.** Guards, decorators, filtro de erro, eventos de segurança, sanitização e `OwnershipService` não são infraestrutura: são regras que atravessam todos os domínios.
4. **Rotas versionadas.** `setGlobalPrefix('api')` + `enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })` produzem `/api/v1/...` sem fixar a string `v1` no código. Uma futura v2 usa `@Version('2')` por controller ou por rota.
5. **Bootstrap único.** `setupApp(app)` centraliza prefixo, versão, cookie parser, helmet, Swagger, validação, interceptadores e filtros. `main.ts` e todos os e2e chamam a mesma função.

## Estrutura alvo

```text
backend/src/
├── main.ts                    # bootstrap + setupApp(app)
├── app/
│   ├── app.module.ts          # composição: infra + shared + módulos de domínio
│   └── setup-app.ts           # configuração compartilhada com os testes
├── infra/
│   ├── config/                # ConfigModule + Joi (REDIS_URL, CACHE_TTL)
│   ├── database/              # PrismaModule + PrismaService
│   ├── cache/                 # CacheModule.registerAsync + Redis + cache-keys.ts
│   ├── http/                  # helmet, Swagger (documentFactory), throttler
│   ├── logging/               # nestjs-pino, redaction, request id
│   ├── observability/         # ObserveModule + TerminusModule
│   └── health/                # HealthController → /api/health
├── shared/
│   ├── identity/              # JwtModule, guards, @Public/@Roles/@CurrentUser, auth.types, OwnershipService
│   ├── errors/                # ApiExceptionFilter (RNF02)
│   ├── security/              # SecurityEventService/interceptor + SensitiveDataInterceptor
│   └── middleware/            # RequestId, sanitização, ValidationPipe
├── modules/
│   ├── auth/                  # RF01 — login, refresh, logout, PasswordService, RefreshTokenService
│   ├── members/               # RF03–RF07
│   ├── staff/                 # RF02
│   ├── workout-plans/         # RF08–RF12
│   ├── check-ins/             # RF13–RF14
│   └── reports/               # RF15–RF18
└── generated/prisma/          # código gerado pelo Prisma — não editar
```

Cada módulo segue o mesmo formato:

```text
modules/workout-plans/
├── workout-plans.module.ts
├── workout-plans.controller.ts
├── workout-plans.service.ts
├── dto/create-workout-plan.dto.ts
├── workout-plans.service.spec.ts
└── README.md
```

O `README.md` de cada módulo descreve: **Responsabilidade** (RF/RD atendidos), **Rotas**, **Regras de negócio**, **Dependências** e **Fora do escopo**. Assim a fronteira de cada módulo fica explícita e revisável.

### Fronteiras

| Pasta | Responsabilidade | Não faz |
| --- | --- | --- |
| `infra/` | Adaptadores para sistemas externos (Postgres, Redis, env, pino, Swagger, Observe) | Regras de negócio, autorização por papel/posse |
| `shared/` | Regras que atravessam domínios (authN/authZ, formato de erro, segurança, sanitização) | Regras de um domínio específico |
| `modules/` | Casos de uso de um domínio | Configuração de banco/cache, pipeline global |

## Rotas

```text
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/staff
POST|GET /api/v1/members
GET|PATCH /api/v1/members/:id
PATCH /api/v1/members/:id/status
PUT  /api/v1/members/:id/trainer
GET  /api/v1/me
POST /api/v1/workout-plans
GET  /api/health          # VERSION_NEUTRAL, estável entre versões
/api/docs                 # Swagger fora da versão
```

```ts
// app/setup-app.ts (esqueleto)
export function setupApp(app: INestApplication): void {
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  configureHttp(app); // helmet + Swagger via documentFactory
  configureValidation(app);
  app.useGlobalInterceptors(/* segurança, dados sensíveis */);
  app.useGlobalFilters(new ApiExceptionFilter());
}
```

Pontos que precisam mudar junto com o prefixo:

- `REFRESH_COOKIE_PATH` passa a ser `/api/v1/auth`, e o teste que espera `Path=/auth` é atualizado.
- `SwaggerModule.createDocument()` vira *factory* (com versionamento ligado, a criação eager perde o prefixo da versão); `useGlobalPrefix` continua `false`, mantendo `/api/docs`.
- Health usa `@Controller({ path: 'health', version: VERSION_NEUTRAL })`. Com `exclude` no prefixo global e versionamento URI, a rota ficaria em `/v1/health` (sem `api`), o que não é desejado.
- Todos os e2e passam a chamar `setupApp(app)`; caso contrário continuam verificando as rotas antigas e passam falso.

## Cache (RNF11)

- [x] Instalar `@nestjs/cache-manager`, `cache-manager`, `@keyv/redis`, `keyv` e `cacheable` (store em memória como fallback).
- [x] `CacheModule.registerAsync({ isGlobal: true, imports: [AppConfigModule], inject: [ConfigService] })` em `infra/cache/`, lendo `REDIS_URL` e `CACHE_TTL` (padrão: 300.000 ms = 5 minutos). Em `NODE_ENV=test`, usa somente memória — os e2e não exigem Redis.
- [x] **Sempre** registrar listener de `error` no store Redis: sem ele, uma queda de conexão derruba o processo. `REDIS_URL` é obrigatório fora de testes e validado como URI `redis://`/`rediss://`.
- [x] Helpers de chaves em `infra/cache/cache-keys.ts` já incluem `userId`/`role` e prefixo de invalidação. O uso nos services de leitura (treino atual do membro e indicadores do admin) entra com os módulos de domínio (T5/Issues #36–#42). Não usar `CacheInterceptor` global: ele chaveia por URL e pode devolver dados de outro usuário (RNF07/RD11), além de não funcionar em rotas com `@Res()` como as de auth.
- Invalidar as chaves na edição e na atribuição de plano (RF11/RF10).

## Task de refatoração e PRs

A issue [#45](https://github.com/Vinny00101/gym-management-web/issues/45) é o pré-requisito das issues #36–#42. Cada item vira um PR separado para `main`, com testes verdes antes do próximo:

| Item | PR | Conteúdo | Status |
| --- | --- | --- | --- |
| T0 | docs | Este documento, README e CHANGELOG | concluído (PR #46) |
| T1 | `refactor(app)` | `setupApp()` compartilhado por `main.ts` e e2e | concluído neste PR |
| T2 | `feat(api)!` | `/api/v1`, cookie, Swagger, health, e2e — única mudança incompatível | concluído neste PR |
| T3 | `refactor(infra)` | Prisma/config/logging/http para `infra/`; CacheModule Redis | concluído neste PR |
| T4 | `refactor(shared)` | Guards, decorators, filtro, eventos e `OwnershipService` | concluído neste PR |
| T5 | `refactor(modules)` | Dividir `AuthModule` em auth/members/staff/workout-plans | concluído neste PR |

## Critérios de aceite

- `npm test`, `npm run test:e2e`, `npm run lint` e `npm run build` passam após cada PR.
- Nenhuma rota antiga permanece sem versão e nenhum e2e deixa de usar `setupApp()`.
- `POST /api/v1/auth/refresh` continua funcionando com o cookie httpOnly.
- Cada módulo tem `README.md` no formato descrito acima.
- As issues #36–#42 são implementadas nos módulos `workout-plans`, `check-ins` e `reports`.
