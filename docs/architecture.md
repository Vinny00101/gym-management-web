# Arquitetura do backend

Voltar para o [README](../README.md).
Este documento apresenta toda a arquitetura que foi proposta para o projeto.

## Estrutura alvo

```text
backend/src/
├── main.ts                    # bootstrap + setupApp(app)
├── app/
│   ├── app.module.ts          # composição: infra + shared + módulos de domínio
│   └── app.config.ts           # configuração compartilhada com os testes
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
| `infra/` | Adaptadores para sistemas externos (Postgres, Redis, env, pino, Observe) | Regras de negócio, autorização por papel/posse |
| `shared/` | Regras que atravessam domínios (authN/authZ, formato de erro, segurança, sanitização) | Regras de um domínio específico |
| `modules/` | Casos de uso de um domínio | Configuração de banco/cache, pipeline global |
